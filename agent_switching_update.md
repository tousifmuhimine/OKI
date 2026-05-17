# OkkiClone: Agent Switching and Role-Based Access Control (RBAC) Updates

This document summarizes the changes made to enforce strict Role-Based Access Control (RBAC) and improve the overall user experience for different account roles within the CRM. It is written in two parts: one for **non-technical stakeholders** (focusing on user experience, features, and capabilities) and one for **technical teams** (focusing on architecture, implementation, and code changes).

---

## 👥 Part 1: Non-Technical Overview
### What We Solved
Previously, any newly registered user or test account defaulted to an "admin" view during early stages of development, or did not strictly lock down the agent interface. We have fully separated the user experiences:
1. **Tousif (`abdullahtsn13@gmail.com`)** is set as an **Admin**, giving him complete, unrestricted access to CRM configs, user management, global statistics, and lead creation.
2. **MrBD (`mrbd234@gmail.com`)** plays the **Agent** role, restriction-bound to only see and manage leads assigned to them.

---

### ✨ Key Features Implemented

#### 1. 🛡️ Tailored Dashboard & Admin Badges
*   **For Admins (Tousif):** 
    *   The top-right user menu now clearly showcases an **"ADMIN ACCESS"** badge, letting you know at a single glance that your account holds master privileges.
    *   Your main dashboard greeting is personalized to read: *"Good morning/afternoon, Tousif sir 👋"* as a mark of your administrator status.
*   **For Standard Agents (MrBD):**
    *   Standard greetings remain clean and natural without "sir/madam".
    *   No admin access badges are displayed in the header.

#### 2. 📊 Restricted Data and Statistics
*   **For Admins:** The Lead Operations dashboard provides complete high-level business analytics, showing **Total Leads**, **Converted**, **Conversion Rate**, and **Top Sources** across the entire company.
*   **For Agents:** Standard agents are kept focused on their own pipelines. Instead of high-level company metrics, they see simplified stats cards showing **"My Assigned Leads"** and **"My Converted"**.

#### 3. 📝 Gated Sidebar Gating (Read vs. Edit Permissions)
*   **For Admins:** Clicking on a lead opens a panel with three options: **Details**, **Activity**, and **Edit**. The edit form allows full lead modification.
*   **For Agents:** The **"Edit"** tab is completely hidden. Agents can read the lead's details and log interaction activities (Calls, Messages, Follow-ups) but cannot alter core customer metadata.

#### 4. 🚀 Better Navigation and UX (Row-Click Activation)
*   **What was fixed:** In the table view, you no longer have to carefully hover and click the tiny, far-right "eye" or "edit" icons.
*   **The Improvement:** The **entire row** is now clickable! Clicking anywhere on a lead's row immediately opens their details in the sidebar with an elegant, responsive slide-in animation. The currently active row gets a subtle highlighted background, keeping your focus clear.

---

## 🛠️ Part 2: Technical Deep Dive
### Architecture & Implementation Details

#### 1. Role Resolution
User roles are fetched from Supabase's `auth` metadata (`user_metadata.role`).
*   In `frontend/components/app-shell.tsx`, the application determines if a user is an `"admin"` or `"agent"`. New registrations or un-assigned users default back strictly to `"agent"` for security.
*   In `frontend/app/leads/page.tsx` and `frontend/app/dashboard/page.tsx`, the client resolves the user object locally via the Supabase client:
    ```tsx
    const role = data.user.user_metadata?.role || "agent";
    ```

#### 2. Core Lead Dashboard Gating
*   **Server-Side Filtering Enforced:** For agents, the client forces the `assigned_to_me` parameter on backend lead queries:
    ```tsx
    if (currentUser?.role === "agent") {
      params.set("quick_filter", "assigned_to_me");
    }
    ```
*   **Magic Convert & Lead Creation:** The Magic Convert text area card and the main "Create New Lead" form are fully wrapped in conditional renders gating them exclusively to admins:
    ```tsx
    {currentUser?.role === "admin" && (
      <>
        {/* Magic Convert Card */}
        {/* Create Lead Form */}
      </>
    )}
    ```

#### 3. UX & Clickability Overhaul
The lead table `<tr>` now binds an `onClick` action while stopping event propagation inside the action icons column to prevent double-firings:
```tsx
<tr
  key={lead.id}
  onClick={() => { setLeadSidebarTab("details"); openLead(lead.id); }}
  className={`cursor-pointer transition hover:bg-white/40 dark:hover:bg-white/10 ${selectedId === lead.id ? "bg-brand-500/8 dark:bg-brand-500/10 ring-1 ring-inset ring-brand-500/20" : ""}`}
>
  ...
  <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
    {/* Action buttons */}
  </td>
</tr>
```

#### 4. Themed Select Form Integrations
The standard native `<select>` dropdown tags within the Lead Edit modal were replaced by a robust `UncontrolledThemedSelect` wrapper that utilizes a hidden input inside `ThemedSelect` to retain direct compatibility with standard `FormData` parsing upon form submissions:
```tsx
const ThemedSelect = ({ name, ... }) => (
  <div className="relative">
    {name && <input type="hidden" name={name} value={value} />}
    ...
  </div>
);
```

---

## 📈 Current Project Status
All changes have been successfully compiled and verified against TypeScript compilation. The dev server is online and active. The repository is ready to be committed and pushed to branch `mk2`.
