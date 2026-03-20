

# Career Page & Hiring System

## Overview
Build a public career page for Signature TV and a backend hiring system. Public users browse openings and apply; super admins create/manage job listings and review applications.

## Database

### New Tables

**`job_listings`**
- `id` uuid PK
- `title` text NOT NULL
- `department` text (e.g. Engineering, Content, Marketing)
- `location` text (e.g. Remote, Lagos)
- `type` text (Full-time, Part-time, Contract)
- `description` text (rich job description)
- `requirements` text
- `benefits` text
- `salary_range` text (optional, nullable)
- `status` text DEFAULT 'active' (active, closed, draft)
- `created_by` uuid (references auth.users)
- `created_at`, `updated_at` timestamps

**`job_applications`**
- `id` uuid PK
- `job_listing_id` uuid FK → job_listings
- `full_name` text NOT NULL
- `email` text NOT NULL
- `phone` text
- `cover_letter` text
- `resume_url` text (file in storage)
- `portfolio_url` text (optional)
- `linkedin_url` text (optional)
- `years_of_experience` integer
- `status` text DEFAULT 'new' (new, reviewed, shortlisted, rejected)
- `notes` text (admin notes)
- `created_at` timestamp

### Storage Bucket
- `resumes` (private bucket) — applicants upload resumes (PDF)
- RLS: insert for anyone, select for super_admins

### RLS Policies
- `job_listings`: SELECT for public where status='active'; ALL for super_admins
- `job_applications`: INSERT for public (no auth required for applying); SELECT/UPDATE/ALL for super_admins

## New Edge Function

**`forward-application`** — Called by admin to email new applications to careers@signaturepicture.co. Uses Supabase's built-in email or a simple fetch to an email endpoint. Actually, to keep it minimal, the admin panel will show a "mailto:" link that opens their email client with pre-filled details, avoiding needing a new email service. Alternatively, we'll just display a "Copy email" and "Open in email" action.

Wait — the requirement says "forward new applications to careers@signaturepicture.co." To avoid needing a new email service, the admin UI will have a button that opens a `mailto:` link with the application details pre-filled. No new edge function needed.

## Files

### New Pages
1. **`src/pages/Careers.tsx`** — Public career page with:
   - Hero section with brand messaging about working at Signature TV
   - Team/culture highlights (cards with icons)
   - Active job listings section (fetched from DB)
   - Each listing expandable or clickable to see details + "Apply" button

2. **`src/pages/JobApplication.tsx`** — Application form page for a specific job:
   - Fields: Full name, Email, Phone, Resume (file upload), Cover letter, Portfolio URL, LinkedIn URL, Years of experience
   - Submits to `job_applications` table + uploads resume to `resumes` bucket

3. **`src/pages/admin/JobListings.tsx`** — Admin CRUD for job listings:
   - Table of all listings with status badges
   - Create/edit job listing form (dialog or inline)
   - Toggle status (active/closed/draft)

4. **`src/pages/admin/JobApplications.tsx`** — Admin view of applications:
   - Table with applicant name, job title, date, status
   - Click to expand details, download resume, update status
   - "Forward to email" button (mailto: link to careers@signaturepicture.co)

### Modified Files
5. **`src/App.tsx`** — Add routes: `/careers`, `/careers/apply/:id`, `/admin/job-listings`, `/admin/applications`
6. **`src/components/admin/AdminLayout.tsx`** — Add "Careers" section to sidebar with Job Listings and Applications sub-items
7. **`src/integrations/supabase/types.ts`** — Auto-updated after migration

## Design Approach
- Career page: dark cinematic theme matching existing site, gradient hero, card-based layout for culture section, clean job listing cards
- Application form: clean form with file upload, validation with toast feedback
- Admin pages: consistent with existing admin table/card patterns

## Route Structure
- `/careers` — Public career page
- `/careers/apply/:jobId` — Application form
- `/admin/job-listings` — Admin job management
- `/admin/applications` — Admin applications review

