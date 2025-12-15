<div align="center">

# 🎓 CCS Contribution Tracker

### Modern Student Contribution Management System

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

<p align="center">
  <strong>A comprehensive, real-time contribution tracking system designed for the College of Computer Studies (CCS).</strong>
</p>

[Live Demo](https://ccs-cts.netlify.app) • [Features](#-features) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [Usage](#-usage)

</div>

---

## 📸 Preview

<div align="center">
  <img src="https://via.placeholder.com/800x400/1e293b/6366f1?text=CCS+Contribution+Tracker+Dashboard" alt="Dashboard Preview" width="100%"/>
</div>

---

## ✨ Features

### 🔐 Authentication & Authorization

- **Secure Authentication** via Supabase Auth (Email/Password)
- **Role-Based Access Control** (Super Admin, Admin, User)
- **Email Verification** with custom branded templates
- **Password Reset** functionality with secure email links
- **First user auto-promotion** to Super Admin role

### 📊 Dashboard

- **Real-time Statistics** with animated counters
- **Role-specific Dashboards** (Super Admin vs Admin views)
- **Quick Actions** for common tasks
- **Recent Activity Feed** with live updates

### 💳 Transaction Management

- **Record Contributions** for individual or multiple students
- **Payment Methods** (Cash, GCash, Maya, Bank Transfer, etc.)
- **Transaction History** with advanced filtering
- **Edit Window** - Modify transactions within a configurable time limit
- **Bulk Operations** with optimistic UI updates

### 👥 Student Management

- **Student Directory** with search and filter
- **CSV/Excel Import** for bulk student registration
- **Import Logs** with detailed success/error tracking
- **Per-semester Student Lists** with automatic archival
- **College & Course Organization**

### 📅 Semester Management

- **Academic Year & Semester** configuration
- **Active Semester** designation for current contributions
- **Semester-based Reporting** and analytics

### 📑 Reports & Exports

- **Comprehensive Reports** per semester
- **Multiple Export Formats**:
  - 📄 PDF with auto-generated tables
  - 📊 Excel (.xlsx) with formatted data
  - 📝 Word Documents (.docx)
  - 📋 CSV for data interchange
- **Customizable Report Filters**

### 👤 User Management

- **Admin User Directory** with role management
- **Suspend/Unsuspend Users** with reason tracking
- **Role Assignment** (Super Admin can promote/demote)
- **Activity Logging** (who set roles, who suspended)

### 🔔 Notification System

- **Real-time Notifications** via Supabase subscriptions
- **Categorized Alerts**:
  - Transaction updates
  - New user registrations
  - Role changes
  - Suspension actions
  - Student imports
- **Notification Preferences** per user
- **Mark as Read** / Mark All as Read

### ⚙️ Settings & Preferences

- **Profile Management** (username, avatar)
- **Notification Preferences** toggle
- **Payment Methods** management (Super Admin)
- **College & Course** configuration
- **Dark/Light Mode** with system preference detection

### 🐾 Mascot Feature

- **Karl the Mascot** - Friendly companion for Super Admins
- **Welcome Messages** with hourly cooldown
- **Idle Emotes** and random expressions
- **Configurable Settings** (enable/disable, timing, auto-open)
- **Mobile-responsive** with menu integration

### 🎨 UI/UX Excellence

- **Glassmorphism Design** with blur effects
- **Smooth Animations** via Framer Motion
- **Responsive Layout** (Mobile, Tablet, Desktop)
- **Dark Mode** with localStorage persistence
- **Dynamic Favicon** based on theme
- **Loading States** with skeleton screens

---

## 🛠 Tech Stack

<table>
<tr>
<td align="center" width="150">

**Frontend**

</td>
<td>

- ⚛️ **React 19** - Latest React with concurrent features
- 🎨 **Tailwind CSS 4** - Utility-first styling
- 🌀 **Framer Motion** - Production-ready animations
- 📊 **Recharts** - Beautiful charts and graphs
- 🧭 **React Router 7** - Client-side routing
- 💾 **Zustand** - Lightweight state management

</td>
</tr>
<tr>
<td align="center">

**Backend**

</td>
<td>

- 🔥 **Supabase** - PostgreSQL Database + Auth + Realtime
- 🔒 **Row Level Security** - Fine-grained access control
- ⚡ **Database Triggers** - Automatic role assignment, notifications
- 📡 **Realtime Subscriptions** - Live data updates

</td>
</tr>
<tr>
<td align="center">

**Exports**

</td>
<td>

- 📄 **jsPDF + AutoTable** - PDF generation
- 📊 **XLSX** - Excel file creation
- 📝 **docx** - Word document generation
- 📋 **PapaParse** - CSV parsing and creation

</td>
</tr>
<tr>
<td align="center">

**Tooling**

</td>
<td>

- ⚡ **Vite 7** - Lightning-fast build tool
- 📏 **ESLint** - Code quality & linting
- 💅 **Lucide React** - Beautiful icon library

</td>
</tr>
</table>

---

## 📦 Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/ccs-contribution-tracker.git
   cd ccs-contribution-tracker
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase database**

   Run the SQL from `supabase/schema.sql` in your Supabase SQL editor to create all required tables, functions, triggers, and RLS policies.

5. **Configure Supabase Auth**

   In Supabase Dashboard → Authentication → URL Configuration:

   - Set **Site URL** to your app URL
   - Add **Redirect URLs** for password reset: `https://your-domain.com/reset-password`

6. **Start development server**
   ```bash
   npm run dev
   ```

---

## 🚀 Usage

### First-Time Setup

1. **Register the first account** - It will automatically become the Super Admin
2. **Configure Settings**:
   - Add payment methods (GCash, Cash, etc.)
   - Set up colleges and courses
   - Create the current semester
3. **Import Students** via CSV/Excel
4. **Start recording contributions!**

### User Roles

| Role            | Permissions                                                       |
| --------------- | ----------------------------------------------------------------- |
| **Super Admin** | Full access - manage users, settings, semesters, all transactions |
| **Admin**       | Record transactions, view students, access reports                |
| **User**        | Limited access (pending approval)                                 |

---

## 📁 Project Structure

```
ccs-contribution-tracker/
├── 📂 public/                    # Static assets (favicons)
├── 📂 src/
│   ├── 📂 assets/               # Images, logos
│   ├── 📂 components/
│   │   ├── 📂 auth/             # Login, Register, Password Reset
│   │   ├── 📂 dashboard/        # Super Admin & Admin dashboards
│   │   ├── 📂 layout/           # Header, MobileMenu, Mascot
│   │   ├── 📂 reports/          # Report generation & exports
│   │   ├── 📂 semesters/        # Semester management
│   │   ├── 📂 settings/         # App settings & preferences
│   │   ├── 📂 students/         # Student list, import, logs
│   │   ├── 📂 transactions/     # Transaction form & history
│   │   ├── 📂 ui/               # Reusable UI components
│   │   └── 📂 users/            # User management
│   ├── 📂 contexts/             # React contexts (Auth)
│   ├── 📂 hooks/                # Custom React hooks
│   ├── 📂 lib/                  # Supabase client, utilities
│   ├── App.jsx                  # Main app & routing
│   ├── main.jsx                 # Entry point
│   └── index.css                # Global styles
├── 📂 supabase/
│   └── schema.sql               # Database schema & migrations
├── .env.example                 # Environment template
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## 🔧 Configuration

### Supabase Email Templates

Custom email templates are configured in Supabase Dashboard → Authentication → Email Templates:

- **Confirm Signup**: Branded verification email
- **Reset Password**: Custom password reset email

### Environment Variables

| Variable                 | Description                   |
| ------------------------ | ----------------------------- |
| `VITE_SUPABASE_URL`      | Your Supabase project URL     |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👏 Acknowledgments

- **College of Computer Studies** - For the inspiration and requirements
- **Supabase** - For the amazing backend-as-a-service
- **React Team** - For React 19 and its concurrent features
- **Tailwind CSS** - For the utility-first CSS framework

---

<div align="center">

**Made with ❤️ for bebu**

[⬆ Back to Top](#-ccs-contribution-tracker)

</div>
