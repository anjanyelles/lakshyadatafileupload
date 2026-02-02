# Laksya Recruitment DB

Full-stack recruitment database with Excel ingestion, search, and role-based access.

## Architecture overview
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Frontend**: React + Vite + Tailwind
- **Uploads**: Excel ingestion + header mapping
- **Auth**: JWT + role-based access

## Installation steps

### Prerequisites
- Node.js 18+
- MongoDB running locally or accessible via URI

### Environment variables

Create these files manually (they are gitignored):

`server/.env`
```
MONGODB_URI=mongodb://localhost:27017/recruitment
PORT=5000
JWT_SECRET=your-secret-key
ANTHROPIC_API_KEY=your-api-key
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-1.5-pro
GEMINI_API_VERSION=v1beta
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
```

`client/.env`
```
VITE_API_URL=http://localhost:5000
```

### Install dependencies
```
npm install
npm install --prefix server
npm install --prefix client
```

## Database setup & indexes

Indexes are declared in schemas and can be created explicitly:
```
npm run create-indexes --prefix server
```

### Candidate
- Text index: `fullName`, `email`, `phone`, `skills`, `location`, `currentCompany`
- Indexes: `experienceYears`, `uploadBatchId`

### HeaderMapping
- Unique index: `headerSignature`

### Upload
- Indexes: `status`, `createdAt`

### User
- Unique index: `email`

## Running locally
```
npm run dev
```

## Docker compose
```
docker compose up --build
```

Frontend: `http://localhost:3000`  
API: `http://localhost:5000`

## Running in production

### Build client
```
npm run build
```

### Start server
```
npm run start
```

### PM2
```
npm install -g pm2
pm2 start server/server.js --name recruitment-api
pm2 save
pm2 startup
```

### Nginx reverse proxy
Use `deploy/nginx.conf` as a template.

## API endpoints documentation

### Auth
- `POST /api/auth/register` (admin only)
- `POST /api/auth/login`
- `GET /api/auth/me`

### Candidates
- `GET /api/candidates`
- `GET /api/candidates/:id`
- `GET /api/candidates/search`
- `GET /api/candidates/stats`

### Uploads
- `POST /api/upload`
- `POST /api/upload/:uploadId/confirm-mapping`
- `GET /api/upload/:uploadId/status`
- `GET /api/uploads`

### Health
- `GET /api/health`

## Seed data

Create admin and recruiter users:
```
npm run seed --prefix server
```

Include 100 sample candidates:
```
npm run seed --prefix server -- --with-candidates
```

## Backup script

```
MONGODB_URI="mongodb://localhost:27017/recruitment" server/scripts/backup.sh
```

Sample cron (daily at 2 AM):
```
0 2 * * * /var/www/recruitment-db/server/scripts/backup.sh >> /var/log/recruitment-backup.log 2>&1
```

## Troubleshooting

- **Mongo connection fails**: verify `MONGODB_URI` and firewall rules.
- **CORS blocked**: ensure `CLIENT_ORIGIN` matches frontend origin.
- **401/403**: confirm JWT token and user role.
- **Uploads fail**: check file type (.xlsx/.xls) and size limits.
- **Search empty**: ensure indexes are created and data exists.

## Test checklist

- Upload Excel ✓
- Map headers ✓
- Search candidates ✓
- View profile ✓
- Login/logout ✓
- Role-based access ✓
