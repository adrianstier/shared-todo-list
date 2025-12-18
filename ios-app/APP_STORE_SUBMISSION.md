# App Store Submission Guide

This guide covers everything needed to submit Shared Todo List to the App Store.

## Pre-Submission Checklist

### Code & Build
- [ ] All features working on physical device
- [ ] No crashes or critical bugs
- [ ] Offline mode tested
- [ ] Push notifications working (on device)
- [ ] iPad layout tested
- [ ] All orientations tested
- [ ] Dark mode tested
- [ ] Dynamic Type (accessibility) tested
- [ ] VoiceOver tested

### App Store Connect
- [ ] App created in App Store Connect
- [ ] App icon uploaded (1024x1024)
- [ ] Screenshots uploaded (all required sizes)
- [ ] App description written
- [ ] Keywords set
- [ ] Privacy policy URL added
- [ ] Support URL added
- [ ] Age rating completed
- [ ] Pricing set

### Required Assets

#### App Icon
- **Size**: 1024x1024 pixels
- **Format**: PNG
- **Requirements**: No transparency, no rounded corners (iOS adds them)

Create your app icon and add it to:
`SharedTodoList/Resources/Assets.xcassets/AppIcon.appiconset/`

#### Screenshots

| Device | Size | Required |
|--------|------|----------|
| iPhone 6.7" | 1290 x 2796 | Yes |
| iPhone 6.5" | 1284 x 2778 | Yes |
| iPhone 5.5" | 1242 x 2208 | Yes |
| iPad Pro 12.9" (6th gen) | 2048 x 2732 | Yes |
| iPad Pro 12.9" (2nd gen) | 2048 x 2732 | Optional |

**Screenshot Tips:**
- Show key features
- Use actual app content (not mockups)
- Consider adding text overlays
- 3-10 screenshots per device

#### App Preview Video (Optional)
- **Duration**: 15-30 seconds
- **Format**: H.264, AAC audio
- **Resolution**: Match screenshot sizes

---

## App Store Metadata

### App Information

```yaml
App Name: Shared Todo List
Subtitle: Family & Team Task Manager
Bundle ID: com.yourcompany.sharedtodolist
SKU: shared-todo-list-001
Primary Language: English (US)
Category: Productivity
Secondary Category: Lifestyle
Content Rights: Does not contain third-party content
Age Rating: 4+
```

### Description

```
Shared Todo List is the simplest way to manage tasks with your family, roommates, or small team. Stay organized together with real-time sync across all your devices.

KEY FEATURES

• Real-time Sync
Changes appear instantly for everyone. No more "did you see my message?" - just check the app.

• Offline Support
Keep working even without internet. Your changes sync automatically when you're back online.

• Smart AI Assistant
Let AI help you write better tasks, break complex projects into subtasks, and even extract tasks from voice notes.

• Due Dates & Reminders
Never miss a deadline with customizable push notifications.

• Priority Levels
Mark tasks as urgent, high, medium, or low priority. Focus on what matters most.

• Subtasks
Break down big tasks into smaller, manageable steps.

• Recurring Tasks
Set daily, weekly, or monthly tasks that automatically reappear.

• Kanban Board
Visualize your workflow with drag-and-drop task management.

• Multiple Views
Switch between list view and kanban board based on your preference.

• Home Screen Widgets
See your tasks at a glance without opening the app.

PERFECT FOR

• Household chores and grocery lists
• Family projects and activities
• Roommate responsibilities
• Small team coordination
• Personal task management

PRIVACY FOCUSED

Your data stays on your devices and our secure servers. We don't sell your information or show you ads.

Works seamlessly with the Shared Todo List web app - manage your tasks from any device.

Questions or feedback? We'd love to hear from you!
```

### Keywords
```
todo, tasks, shared, family, team, checklist, reminders, productivity, collaboration, grocery, chores, organize, lists, project, planning
```

### What's New (Version 1.0)
```
Initial release! Shared Todo List brings real-time task collaboration to iOS with:

• Real-time sync across all devices
• Offline support with automatic sync
• AI-powered task enhancement
• Push notifications for reminders
• Home screen widgets
• iPad support with adaptive layouts
• Face ID / Touch ID authentication
```

### Support URL
```
https://your-domain.com/support
```

### Marketing URL (Optional)
```
https://your-domain.com
```

### Privacy Policy URL
```
https://your-domain.com/privacy
```

---

## Privacy Policy Template

Create a privacy policy page at your domain. Here's a template:

```markdown
# Privacy Policy for Shared Todo List

Last updated: [DATE]

## Overview

Shared Todo List ("we", "our", or "us") respects your privacy. This policy explains how we collect, use, and protect your information.

## Information We Collect

### Account Information
- Name (chosen by you)
- 4-digit PIN (stored securely as a hash)

### Task Data
- Task descriptions and details
- Due dates and priorities
- Subtasks

### Device Information
- Device token (for push notifications)
- Device type and OS version

### Usage Data
- Login timestamps
- Feature usage statistics (anonymized)

## How We Use Your Information

- To provide and maintain the service
- To sync your tasks across devices
- To send push notifications you've opted into
- To improve our service

## Data Storage

Your data is stored securely on Supabase servers with encryption at rest and in transit.

## Data Sharing

We do not sell, trade, or rent your personal information. We may share data only:
- With your consent
- To comply with legal obligations
- To protect our rights

## Your Rights

You can:
- Access your data through the app
- Delete your account and data
- Opt out of push notifications

## Children's Privacy

Our service is not directed to children under 13. We do not knowingly collect information from children.

## Changes to This Policy

We may update this policy periodically. We'll notify you of significant changes through the app.

## Contact Us

For privacy questions, contact us at: [EMAIL]
```

---

## Export Compliance

The app uses standard HTTPS encryption. In Info.plist, we've set:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

This indicates we only use standard encryption and don't need export compliance documentation.

---

## App Review Notes

Include these notes for the App Review team:

```
Test Account:
- The app uses PIN-based authentication
- Create a new account with any name and 4-digit PIN
- Or use existing test accounts if provided

Testing Push Notifications:
- Push notifications require a physical device
- You can test the app without notifications in the simulator

Features to Review:
1. Task creation with AI enhancement
2. Real-time sync (test with two devices)
3. Offline mode (enable airplane mode)
4. Push notification preferences in Settings
5. Home screen widgets

Backend:
- The app connects to Supabase for data storage
- AI features use Anthropic's Claude API through our server
```

---

## Submission Steps

### 1. Archive the App

1. In Xcode, select **Product** > **Archive**
2. Wait for the archive to complete
3. The Organizer window will open

### 2. Validate

1. In Organizer, select your archive
2. Click **Validate App**
3. Follow the prompts
4. Fix any issues reported

### 3. Distribute

1. Click **Distribute App**
2. Select **App Store Connect**
3. Select **Upload**
4. Follow the prompts

### 4. App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to the build section
4. Wait for build processing (can take 30+ minutes)
5. Select the build
6. Complete all metadata
7. Submit for review

---

## Common Rejection Reasons

Avoid these common issues:

1. **Crashes** - Test thoroughly on real devices
2. **Broken links** - Verify support/privacy URLs work
3. **Incomplete metadata** - Fill in all required fields
4. **Placeholder content** - Remove any "Lorem ipsum" or test data
5. **Missing login info** - Provide test account details
6. **Privacy issues** - Ensure privacy policy is complete and accessible
7. **Performance** - App should be responsive and efficient

---

## Post-Submission

After submission:

1. **Monitor status** in App Store Connect
2. **Respond quickly** to any App Review questions
3. **Prepare marketing** materials for launch
4. **Set up analytics** to track downloads and usage
5. **Plan updates** based on user feedback
