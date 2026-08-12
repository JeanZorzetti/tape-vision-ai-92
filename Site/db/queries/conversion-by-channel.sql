-- SC-004: conversion rate by acquisition channel (organic / ai) over the trailing
-- 3 months. Leads by channel come from this query; the denominator (sessions by
-- channel) comes from Vercel Web Analytics (data-model.md §3).
select referral_channel,
       count(*) as leads
from waitlist_lead
where deleted_at is null
  and created_at >= now() - interval '3 months'
  and referral_channel in ('organic', 'ai')
group by referral_channel;
