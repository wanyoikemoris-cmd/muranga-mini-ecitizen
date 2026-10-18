# Murang’a Public Service Request System

A mini eCitizen-style web application that enables citizens to submit public service requests and track their progress, while administrators review requests and update their status.

## Features

### Citizen portal
- Citizen registration and login.
- Submit requests by service category, constituency, ward, location and description.
- Optional image attachments for supporting evidence.
- Automatic request reference numbers.
- View submitted requests and track their status.

### Administrator portal
- View service requests.
- Update request status: Pending, In Progress or Resolved.
- View request details and uploaded images.
- Dashboard statistics for monitoring requests.

### Security
- Supabase Authentication for user accounts.
- Row Level Security (RLS) policies to restrict access to requests.
- Private Supabase Storage bucket for request images.
- Authenticated image access through signed URLs.
- Environment variables for Supabase client configuration.

## Technology Stack

- React
- Vite
- JavaScript
- CSS
- Supabase Authentication
- Supabase PostgreSQL database
- Supabase Storage

## Getting Started

### Prerequisites

Install Node.js and npm. A Supabase project is also required.

### Installation

Clone the repository:

```bash
git clone https://github.com/wanyoikemoris-cmd/muranga-mini-ecitizen.git
cd muranga-mini-ecitizen
npm install
```

### Environment Configuration

Create a `.env.local` file in the project root and add your own Supabase project details:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Replace the placeholder values with the corresponding values from your Supabase project. Never put a Supabase secret key in frontend code or commit credentials to GitHub.

### Run Locally

```bash
npm run dev
```

Open the local URL printed in the terminal.

### Build for Production

```bash
npm run build
```

Vite generates the production files in the `dist` directory.

## Database and Storage Setup

Configure the Supabase project with the required database tables, columns, indexes, Row Level Security policies and private image-storage bucket.

The main `service_requests` table stores request reference numbers, user IDs, service categories, constituencies, wards, locations, descriptions, image paths, statuses and timestamps.

The `app_admins` table identifies authorized administrators. An administrator account must be explicitly authorized in the database.

Create the `request-images` storage bucket with the intended file-size and image-type restrictions. Configure storage policies to limit uploads and image access to authorized users.

Apply and verify the database and storage policies before deploying the application.

## Request Statuses

- **Pending:** The request has been submitted and is awaiting action.
- **In Progress:** The request is being handled.
- **Resolved:** The request has been marked as resolved.

## Testing Checklist

- [ ] Citizen can register and log in.
- [ ] Constituency selection displays the correct wards.
- [ ] A request can be submitted without an image.
- [ ] A request can be submitted with an image.
- [ ] Requests remain available after refreshing the application.
- [ ] Citizens cannot view or modify another citizen's requests.
- [ ] An administrator can update request statuses.
- [ ] Dashboard statistics reflect the stored requests.
- [ ] Production build completes successfully.

## Future Improvements

- Search and filtering by constituency, ward and status.
- More detailed service-request analytics.
- Email or SMS notifications.
- Improved accessibility and mobile responsiveness.
- Request-resolution feedback from citizens.

## Project Purpose

This project demonstrates practical skills in frontend development, authentication, database integration, file uploads, access control, user experience design and software documentation.

**Developer:** Moris Wanyoike King’aiya