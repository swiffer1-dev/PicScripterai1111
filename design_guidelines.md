# Picscripter Design Guidelines

## Design Approach

**Selected Approach:** Design System with Productivity Tool References

**Justification:** Picscripter is a utility-focused social media management platform where efficiency, clarity, and reliability are paramount. Drawing inspiration from Linear's precision, Notion's organization, and Buffer's workflow clarity while maintaining systematic consistency.

**Core Principles:**
- Clarity over decoration: Every element serves a functional purpose
- Information density without clutter: Dense data presented with breathing room
- Predictable patterns: Users should instantly understand how to interact
- Speed and efficiency: Minimize clicks, maximize productivity

## Typography System

**Font Families:**
- Primary: Inter (via Google Fonts) - UI elements, navigation, buttons
- Secondary: SF Mono or JetBrains Mono - Code snippets, API tokens, IDs
- Accent: Inter Medium/Semibold - Headers, emphasis

**Hierarchy:**
- Page Titles: text-3xl font-semibold (tracking-tight)
- Section Headers: text-xl font-semibold
- Card Titles: text-lg font-medium
- Body Text: text-base font-normal
- Secondary Text: text-sm
- Captions/Meta: text-xs
- Button Labels: text-sm font-medium (uppercase tracking-wide for primary actions)

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16 consistently
- Micro spacing (within components): p-2, gap-2
- Standard spacing (between elements): p-4, gap-4, m-6
- Section spacing: p-8, py-12
- Large spacing (between major sections): p-16, gap-16

**Grid Structure:**
- Max container width: max-w-7xl
- Standard padding: px-4 sm:px-6 lg:px-8
- Dashboard layout: Fixed sidebar (16rem width) + main content area
- Card grids: grid-cols-1 md:grid-cols-2 xl:grid-cols-3 for platform connections
- Post feed: Single column max-w-4xl centered for optimal readability

## Component Library

### Navigation & Structure

**Top Navigation Bar:**
- Height: h-16
- Fixed position with backdrop-blur
- Content: Logo (left), search bar (center), user profile + notifications (right)
- Spacing: px-6, items vertically centered

**Sidebar Navigation:**
- Width: w-64 (fixed on desktop, overlay on mobile)
- Items: py-2 px-4 with rounded-lg hover states
- Icons: 20x20 from Heroicons
- Active state: font-semibold with subtle indicator
- Sections: Dashboard, Connections, Posts, Schedule, Analytics, Settings

**Dashboard Cards:**
- Border: border rounded-lg
- Padding: p-6
- Shadow: shadow-sm with subtle hover:shadow-md transition
- Header: flex justify-between items-start mb-4

### Connection Management

**Platform Connection Cards:**
- Grid layout: 3 columns on desktop, responsive to 1 column mobile
- Card structure:
  - Platform icon (48x48) + name
  - Connection status badge (text-xs px-2 py-1 rounded-full)
  - Account handle/name (text-sm truncate)
  - "Connected on [date]" meta text (text-xs)
  - Disconnect button (text-sm underline)
- Empty state: Dashed border with "Connect [Platform]" CTA

**OAuth Connection Flow:**
- Modal overlay: Centered modal with max-w-md
- Steps indicator: 1. Authorize 2. Confirm 3. Complete
- Platform logo prominent at top
- Required scopes listed (text-sm with checkmarks)
- Primary CTA: "Continue to [Platform]" button

### Post Creation & Scheduling

**Post Composer:**
- Full-width card: max-w-3xl centered
- Platform selector: Radio buttons with platform icons in horizontal scroll
- Caption textarea: min-h-32 with character counter per platform
- Media upload: Drag-drop zone (h-48) with thumbnail preview
- Schedule section: Collapsible with date/time picker
- Preview pane: Shows how post appears on selected platform (mock UI)
- Action buttons: "Save Draft" (secondary), "Schedule" or "Post Now" (primary)

**Character Counter:**
- Position: Below textarea, right-aligned
- Format: "120 / 280" with warning state when approaching limit
- Size: text-xs

**Schedule Picker:**
- Calendar grid: 7-column layout
- Time slots: 15-minute increments in scrollable list
- Quick actions: "Now", "In 1 hour", "Tomorrow 9am"
- Timezone display: text-xs below picker

### Post Management

**Posts Feed/List:**
- List layout with alternating subtle backgrounds
- Each post item:
  - Platform icon (24x24) + timestamp
  - Caption preview (2-line clamp with "Show more")
  - Thumbnail (if media, 80x80 rounded)
  - Status badge (scheduled/published/failed)
  - External post link (if published)
  - Action menu: Edit, Duplicate, Delete
- Filters: Platform dropdown + Status dropdown + Date range
- Spacing: py-4 px-6, border-b on items

**Status Indicators:**
- Badge style: inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
- Icons: Small status icons (12x12) within badges
- States: Queued, Publishing (with spinner), Published (checkmark), Failed (alert icon)

### Data Display & Tables

**Connection Status Table:**
- Headers: text-xs uppercase tracking-wider font-medium
- Rows: py-4 px-6 hover:bg transition
- Columns: Platform, Account, Status, Last Used, Scopes, Actions
- Action buttons: Icon buttons (16x16 icons) in flex gap-2

**Analytics/Stats Cards:**
- Grid of metric cards: 2x2 on desktop
- Each card: p-6, border rounded-lg
- Metric value: text-3xl font-bold
- Metric label: text-sm
- Trend indicator: Small arrow icon + percentage (text-xs)

### Forms & Inputs

**Text Inputs:**
- Base: px-3 py-2 border rounded-md
- Focus: ring-2 outline-none
- Labels: text-sm font-medium mb-1.5 block
- Helper text: text-xs mt-1

**Buttons:**
- Primary: px-4 py-2 rounded-md font-medium shadow-sm
- Secondary: px-4 py-2 rounded-md font-medium border
- Text/Ghost: px-3 py-1.5 font-medium
- Icon buttons: p-2 rounded-md (for actions in tables/lists)
- Sizes: sm (text-sm px-3 py-1.5), base (default), lg (px-6 py-3 text-base)

**Dropdowns/Selects:**
- Trigger: Same styling as text inputs
- Menu: absolute mt-1 shadow-lg border rounded-md overflow-hidden
- Items: px-4 py-2 hover:bg cursor-pointer
- Selected item: font-medium with checkmark icon

**Toggle Switches:**
- Size: w-11 h-6 rounded-full
- Knob: w-5 h-5 rounded-full, translates on toggle
- Labels: text-sm adjacent to switch

### Feedback & States

**Loading States:**
- Skeleton screens: Animated pulse on rectangles matching content layout
- Spinners: 20x20 for inline actions, 40x40 for page loads
- Progress bars: h-1 rounded-full for multi-step processes

**Empty States:**
- Centered content with max-w-md
- Illustration or large icon (96x96)
- Heading: text-xl font-semibold
- Description: text-sm
- CTA button: Primary style

**Error/Success Messages:**
- Toast notifications: Fixed top-right, max-w-sm
- Structure: Icon (20x20) + message + dismiss button
- Padding: p-4, rounded-lg, shadow-lg
- Auto-dismiss: 5s for success, manual for errors

**Modal Dialogs:**
- Overlay: Fixed inset-0 with backdrop
- Container: max-w-lg mx-auto mt-20 rounded-lg shadow-xl
- Header: px-6 py-4 border-b
- Body: px-6 py-4
- Footer: px-6 py-4 border-t with action buttons right-aligned

### Specialized Components

**Platform Icons Grid:**
- Display all 7 supported platforms in consistent size (40x40)
- Arrangement: Horizontal scroll on mobile, grid on desktop
- Spacing: gap-4
- Interactive: Clickable with hover scale transform

**Token Display (for developers):**
- Monospace font in bordered container
- Background: Subtle distinct treatment
- Copy button: Absolute positioned top-right
- Masked by default with "Show" toggle

**Webhook URL Field:**
- Read-only input with copy functionality
- Icon prefix showing lock/secure indicator
- Full width with text-sm font-mono

## Page Layouts

### Dashboard (Home)
- Grid of stat cards at top (4-column responsive)
- Recent posts list below (max-w-4xl)
- Quick post button: Floating action button (fixed bottom-right on mobile, inline on desktop)

### Connections Page
- Page header with "Add Connection" button
- Platform cards in responsive grid
- Each platform expandable to show connection details

### Posts & Schedule Page
- Filter bar: Sticky top position below nav
- Tabs: "All Posts", "Scheduled", "Published", "Drafts"
- List view with infinite scroll or pagination

### Settings Page
- Sidebar navigation (on left): Profile, Security, Notifications, API, Billing
- Content area: Forms with section divisions (border-b py-8)

## Responsive Behavior

**Breakpoints:**
- Mobile: < 768px (stacked layouts, collapsible sidebar as drawer)
- Tablet: 768px - 1024px (2-column grids become single)
- Desktop: > 1024px (full layout with fixed sidebar)

**Mobile Adaptations:**
- Bottom navigation bar (h-16) replacing sidebar
- Simplified post composer (single-column)
- Modal-based filters/settings instead of inline
- Touch-friendly tap targets (min h-12)

## Accessibility

- Maintain WCAG 2.1 AA compliance throughout
- Focus indicators: ring-2 offset-2 on all interactive elements
- ARIA labels on icon-only buttons
- Keyboard navigation support with visible focus states
- Screen reader announcements for status changes
- Form validation with clear error messaging

## Images

**Platform Logos:**
- Use official platform logos/icons at consistent sizes
- Sources: Instagram, TikTok, Twitter/X, LinkedIn, Pinterest, YouTube, Facebook branded assets
- Sizes: 24x24 (inline), 40x40 (cards), 48x48 (connection cards)

**Empty State Illustrations:**
- Custom illustrations for empty connections, no posts, etc.
- Style: Simple line art or abstract shapes
- Placement: Centered in empty state containers

**User Profile Images:**
- Circular avatars: w-8 h-8 (nav), w-10 h-10 (cards), w-16 h-16 (profile page)
- Fallback: Initials on solid background

No large hero images needed - this is a dashboard/tool application focused on utility and productivity.