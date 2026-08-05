# Engineering Study Planner Pro — Phases 7–13

This release builds on Phase 6 and includes Phases 7 through 13 in one project.

## Phase 7 — Exam Preparation
- Exam countdown
- Syllabus/topic checklist
- Topic completion %
- Important topics
- Practice-question tracker
- Revision notes
- Send exam into Smart Planner

## Phase 8 — Study Analytics
- Subject completion
- Assignment completion
- Attendance performance
- Completed Smart Planner study time
- Productivity snapshot
- Responsive analytics dashboard

## Phase 9 — Notifications + Goals
- Assignment deadline alerts
- Exam countdown alerts
- Attendance-risk alerts
- Mark read / mark all read
- Daily study target
- Weekly study target
- Study-time logging
- Study streak tracking

## Phase 10 — Admin Panel 2.0
- Student search
- Student/academic record monitoring
- Database health statistics
- Existing student cascade deletion
- Admin-only API authorization
- Admin records for subjects, assignments, exams and attendance

## Phase 11 — Student Profile 2.0
- Profile editing
- College, branch, semester and roll number
- Password management
- PDF report
- JSON backup

## Phase 12 — Security
- Helmet security headers
- Authentication rate limiting
- JWT authentication
- bcrypt password hashing
- Role-based admin authorization
- User data isolation
- Server-side validation
- Protected password-change endpoint
- No password is exposed in safe user responses

## Phase 13 — Deployment
Included:
- `Dockerfile`
- `.dockerignore`
- `render.yaml`
- Production environment variables
- `/api/health` health endpoint
- Node production start command

### Local setup

```bash
npm install
npm start
```

Create `.env` from `.env.example`.

Local MongoDB:
`mongodb://127.0.0.1:27017/engineering_study_planner`

Open:
`http://localhost:5000`

### Admin setup

Create a normal account first, then use the existing `/api/setup-admin` endpoint with the `ADMIN_SETUP_KEY`.

### Production deployment

Use MongoDB Atlas (or another managed MongoDB service) for production. Set `MONGO_URI`, `JWT_SECRET`, `ADMIN_SETUP_KEY`, and `NODE_ENV=production` in your host's environment settings.

For Render, the included `render.yaml` provides the basic web-service configuration. Do not commit `.env` or real secrets.

For Docker:

```bash
docker build -t engineering-study-planner .
docker run --env-file .env -p 5000:5000 engineering-study-planner
```

## Important limitation

The notification, exam-prep checklist and study-goal history are intentionally stored in browser localStorage in this release. Core academic records remain in MongoDB. For a multi-device production release, these modules should be migrated to MongoDB collections.

## Suggested next improvements

- Email/password reset using a transactional email provider
- MongoDB-backed notifications, goals and exam topics
- Real-time notifications
- Cloud file storage for notes/attachments
- Automated backups
- CI/CD pipeline
- Automated tests
