import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'TRADER' | 'VIEWER' | 'SERVICE';
  permissions: string[];
  
  // Trading specific fields
  tradingEnabled: boolean;
  maxDailyLoss: number;
  maxPositionSize: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Account status
  isActive: boolean;
  isVerified: boolean;
  lastLogin: Date;
  loginAttempts: number;
  lockUntil?: Date;
  
  // API access
  apiKey?: string;
  apiKeyEnabled: boolean;
  apiKeyExpires?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateApiKey(): string;
  incrementLoginAttempts(): Promise<void>;
  isLocked(): boolean;
  canTrade(): boolean;
}

// User Schema
const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres'],
    select: false // Don't include password in queries by default
  },
  
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  
  role: {
    type: String,
    enum: ['ADMIN', 'TRADER', 'VIEWER', 'SERVICE'],
    default: 'TRADER',
    required: true
  },
  
  permissions: [{
    type: String,
    enum: [
      'TRADING_ENABLED',
      'ML_ACCESS',
      'ADMIN_ACCESS',
      'API_ACCESS',
      'RISK_OVERRIDE',
      'SESSION_MANAGEMENT',
      'USER_MANAGEMENT',
      'SYSTEM_CONFIG'
    ]
  }],
  
  // Trading Configuration
  tradingEnabled: {
    type: Boolean,
    default: true
  },
  
  maxDailyLoss: {
    type: Number,
    default: 500,
    min: [0, 'Perda máxima diária não pode ser negativa'],
    max: [10000, 'Perda máxima diária muito alta']
  },
  
  maxPositionSize: {
    type: Number,
    default: 2,
    min: [1, 'Tamanho máximo de posição deve ser pelo menos 1'],
    max: [50, 'Tamanho máximo de posição muito alto']
  },
  
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'MEDIUM'
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  lastLogin: {
    type: Date
  },
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: {
    type: Date
  },
  
  // API Access
  apiKey: {
    type: String,
    select: false
  },
  
  apiKeyEnabled: {
    type: Boolean,
    default: false
  },
  
  apiKeyExpires: {
    type: Date
  }
  
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.apiKey;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ apiKey: 1 }, { sparse: true });

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function(this: IUser) {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Methods
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

UserSchema.methods.generateApiKey = function(): string {
  const apiKey = `tape_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  this.apiKey = apiKey;
  this.apiKeyEnabled = true;
  this.apiKeyExpires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
  return apiKey;
};

UserSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we have hit max attempts and it's not locked, lock the account
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    (updates as any).$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

UserSchema.methods.isLocked = function(): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

UserSchema.methods.canTrade = function(): boolean {
  return this.isActive && 
         this.tradingEnabled && 
         !this.isLocked() && 
         this.permissions.includes('TRADING_ENABLED');
};

// Static methods
UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findActiveTraders = function() {
  return this.find({ 
    isActive: true, 
    tradingEnabled: true,
    role: { $in: ['TRADER', 'ADMIN'] }
  });
};

export const User = model<IUser>('User', UserSchema);
export default User;