# Restaurant Orders App

Full-stack restaurant ordering system with real-time order tracking and admin dashboard.

## Features

- 🛒 Customer ordering interface
- 👨‍🍳 Kitchen/Admin dashboard
- 📱 Real-time order updates via WebSocket
- 🎨 Modern UI with glassmorphism design
- 🔐 Secure admin authentication

## Live Demo

- **Customer Interface**: [Your deployed URL]
- **Admin Dashboard**: [Your deployed URL]/admin.html
  - Username: `admin`
  - Password: `admin123`

## Tech Stack

- **Backend**: Node.js, Express, SQLite, WebSocket
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Icons**: Lucide Icons

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open http://localhost:3000

## Deployment

See [deployment-guide.md](deployment-guide.md) for detailed instructions.

### Quick Deploy to Render

1. Push code to GitHub
2. Connect repository to Render
3. Set environment variables:
   - `PORT`: 3000
   - `NODE_ENV`: production
   - `SESSION_SECRET`: (random string)
4. Deploy!

## Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `SESSION_SECRET`: Session encryption key

## License

ISC
