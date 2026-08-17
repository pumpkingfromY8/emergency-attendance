# emergency-attendance
React + Vite + Supabase Emergency Attendance System


Supabase Auth
       │
       ├── Admin accounts
       │
       └── Employee authentication
       
Supabase PostgreSQL
       │
       ├── employees
       ├── attendance
       ├── emergency_events
       ├── office_settings
       └── audit_logs

Supabase Storage
       │
       └── attendance-photos/


GPS + photo

I would make the verification sequence:
Employee ID/PIN
       ↓
Check employee
       ↓
Determine attendance period
       ↓
Get GPS
       ↓
Check office radius
       ↓
Open camera
       ↓
Capture photo
       ↓
Submit
       ↓
Server validates time
       ↓
Save attendance


Source Code Structure:

lgu-emergency-attendance/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── styles.css
│   └── lib/
│       ├── supabase.js
│       ├── time.js
│       ├── geo.js
│       └── camera.js
├── supabase/
│   ├── schema.sql
│   └── seed.sql
├── .env.example
├── .gitignore
├── index.html
├── package.json
└── README.md

Emergency security features

The project includes:

📷 Live camera/photo capture
📍 GPS verification
📏 Office geofence/radius
🕐 Philippine time
🆔 Employee ID lookup
🔒 Duplicate attendance prevention
🚨 Emergency Mode
👨‍💼 Admin dashboard
✅ Pending/Approved/Rejected verification
📊 CSV export
🗄️ Supabase PostgreSQL
🖼️ Supabase Storage for attendance photos
📋 Emergency event records
📱 Mobile-responsive interface
