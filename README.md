# LGU Emergency Attendance System

React + Vite + Supabase backup attendance system for use only when the normal biometric attendance system is unavailable.

## Attendance windows

The system uses Philippine time (`Asia/Manila`) and supports exactly these windows:

- Morning Time In: 7:30 AM–7:59 AM
- Morning Time Out: 12:01 PM–12:29 PM
- Afternoon Time In: 12:31 PM–12:59 PM
- Afternoon Time Out: 5:01 PM–5:59 PM

The employee cannot select the attendance type manually. The currently open window determines the transaction.

## Main features

- Emergency Mode activated by authorized admin
- Employee ID lookup
- Camera/live photo capture
- GPS/geofence verification
- Automatic Philippine-time attendance window
- Duplicate prevention
- Pending/Approved/Rejected review
- CSV export
- Supabase Storage for attendance photos
- Responsive mobile-friendly UI

## 1. Create the project

```bash
npm install
```

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_OFFICE_LAT=YOUR_OFFICE_LATITUDE
VITE_OFFICE_LNG=YOUR_OFFICE_LONGITUDE
VITE_GEOFENCE_RADIUS_METERS=100
```

Never put a Supabase service-role key in Vite frontend code.

## 2. Configure Supabase

Open Supabase Dashboard → SQL Editor and run:

`supabase/schema.sql`

Then create an administrator account under:

Authentication → Users → Add user

The Admin page uses Supabase email/password authentication.

Add employee records in the `employees` table, for example:

```sql
insert into public.employees(employee_no, full_name, department)
values
('EMP-0001', 'Juan Dela Cruz', 'Office of the Mayor'),
('EMP-0002', 'Maria Santos', 'HRMO');
```

## 3. Set the office location

Get the latitude/longitude of the actual office and put them in `.env`.

Example:

```env
VITE_OFFICE_LAT=8.123456
VITE_OFFICE_LNG=125.123456
VITE_GEOFENCE_RADIUS_METERS=100
```

Do not use the example coordinates as your real office location.

## 4. Run

```bash
npm run dev
```

For production build:

```bash
npm run build
npm run preview
```

## 5. Recommended emergency procedure

1. Authorized personnel opens Admin.
2. Admin signs in.
3. Admin activates Emergency Mode and records the reason.
4. Employees use the Attendance page.
5. Employee ID is checked.
6. System determines the currently valid attendance window.
7. Employee captures a live photo.
8. Employee verifies GPS.
9. Attendance is submitted as `PENDING`.
10. HR/Admin reviews and marks it APPROVED or REJECTED.
11. The emergency record can be exported as CSV and used as supporting documentation for a blank DTR according to office policy.
12. Admin closes Emergency Mode after the emergency.

## Important security note

This repository is an MVP. The browser can be manipulated by a technically skilled user. For an official production deployment, use a Supabase Edge Function or another trusted server-side endpoint to validate:

- Philippine date/time
- Four attendance windows
- active emergency event
- employee status
- duplicate attendance
- office geofence
- allowed attendance method
- audit logging

Do not rely solely on JavaScript/browser validation for an official attendance record.

## Privacy

The system captures employee photo and location only when the employee submits emergency attendance. Avoid continuous location tracking. Define retention, access, and deletion rules with the LGU/HR/privacy officer before production use.
