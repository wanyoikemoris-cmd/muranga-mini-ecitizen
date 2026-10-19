# Murang’a Public Service Request System

A mini eCitizen-style web application that enables citizens to submit public service requests, attach supporting images, and track request progress. Administrators can review submitted requests, update their status, and monitor requests through a dashboard.

**Live application:** [https://muranga-mini-ecitizen.vercel.app/](https://muranga-mini-ecitizen.vercel.app/)
**Source code:** [https://github.com/wanyoikemoris-cmd/muranga-mini-ecitizen](https://github.com/wanyoikemoris-cmd/muranga-mini-ecitizen)

## Features

### Citizen Portal

- Citizen registration and login.
- Password recovery and password reset.
- Submit service requests using service category, constituency, ward, location, and description.
- Optional JPG and PNG image attachments as supporting evidence.
- Automatic request reference numbers.
- View submitted requests and track their status.
- View uploaded supporting images.

### Administrator Portal

- View service requests and their details.
- Update request status to Pending, In Progress, or Resolved.
- View uploaded supporting images.
- Monitor requests using dashboard statistics.
- Restrict administrative functionality to authorized administrators.

### Security

- Supabase Authentication for account management.
- PostgreSQL Row Level Security (RLS) policies for request access control.
- Citizen access restricted to their own requests, subject to the configured database policies.
- Administrator access controlled through the `app_admins` table.
- Private Supabase Storage bucket for request images.
- Authenticated image access using signed URLs.
- Environment variables for Supabase client configuration.

## Technology Stack

- React
- Vite
- JavaScript
- CSS
- Supabase Authentication
- Supabase PostgreSQL database
- Supabase Storage
- Git and GitHub
- Vercel deployment

## Getting Started

### Prerequisites

- Node.js and npm
- A Supabase project with the required database tables, policies, and storage configuration

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/wanyoikemoris-cmd/muranga-mini-ecitizen.git
cd muranga-mini-ecitizen
npm install
```

### Environment Configuration

Create a `.env.local` file in the project root and configure your Supabase project details:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Replace the placeholder values with the appropriate values from your Supabase project.

**Security note:** Never place a Supabase secret or service-role key in frontend code or commit credentials to GitHub. Environment variables prefixed with `VITE_` are exposed to client-side code, so only use keys intended for public client access.

### Run Locally

```bash
npm run dev
```

Open the local URL displayed in the terminal.

### Build for Production

```bash
npm run build
```

Vite generates the production files in the `dist` directory.

## Database and Storage

The application uses Supabase to store service requests, authenticate users, and manage supporting images.

### Service Requests

The `service_requests` table stores request information, including user IDs, reference numbers, service details, locations, image paths, statuses, and timestamps.

Row Level Security policies control access to service requests. The intended access model allows citizens to submit and view their own requests while authorized administrators can review requests and update their status.

### Administrator Authorization

The `app_admins` table identifies users authorized to perform administrative actions. Administrator access must be explicitly granted through the database configuration.

### Image Storage

The `request-images` bucket stores supporting images. It is configured as a private bucket, with access controlled through storage policies and authenticated access mechanisms.

For a fresh deployment, configure the required database schema, RLS policies, storage bucket, and storage policies before using the application.

## Request Statuses

- **Pending:** The request has been submitted and is awaiting action.
- **In Progress:** The request is being handled.
- **Resolved:** The request has been marked as resolved.

## Testing Checklist

The following functional tests have been reported as completed during development.

- [x] Citizen registration and login.
- [x] Weak passwords are rejected during registration.
- [x] Password recovery email and password-reset flow.
- [x] Service-request submission.
- [x] Request submission with and without an image.
- [x] JPG and PNG image uploads and viewing.
- [x] Requests remain available after refreshing the application.
- [x] Citizens can view their own requests and track status changes.
- [x] Citizen access is restricted from administrative functionality.
- [x] Administrators can update request statuses.
- [x] Dashboard statistics reflect stored request data.
- [x] Database and storage access rules reviewed.
- [x] Production build completes successfully.
- [x] Sign Out is visible on mobile.

## Future Improvements

- Search and filtering by constituency, ward, and status.
- More detailed service-request analytics.
- Email or SMS notifications for status changes.
- Further accessibility and mobile usability improvements.
- Citizen feedback on resolved requests.

## Project Purpose

This project demonstrates practical skills in frontend development, authentication, database integration, file uploads, access control, responsive user-interface design, deployment, and software documentation.

**Developer:** Moris Wanyoike King’aiya
