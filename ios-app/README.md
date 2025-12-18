# Shared Todo List - iOS App

Native iOS app for the Shared Todo List, built with SwiftUI for iOS 17+.

## Features

- **Full Feature Parity** with web app
- **Real-time Sync** via Supabase Realtime
- **Offline Support** with local caching and sync queue
- **Push Notifications** for task reminders and assignments
- **iPad Support** with adaptive layouts
- **Widgets** for home screen task overview (3 sizes)
- **Siri Shortcuts** for voice commands
- **Face ID / Touch ID** authentication
- **Kanban Board** with drag & drop

## Requirements

- iOS 17.0+
- iPadOS 17.0+
- Xcode 15.0+
- Swift 5.9+
- Apple Developer Account (for push notifications and App Store)

## Quick Start

### Option 1: Automated Setup

```bash
# Run the setup script (handles Supabase CLI, deployment, and migration)
./scripts/setup-ios-backend.sh
```

### Option 2: Manual Setup

#### 1. Open Project in Xcode

```bash
cd ios-app
open SharedTodoList.xcodeproj
```

Xcode will automatically resolve Swift Package Manager dependencies (Supabase SDK).

#### 2. Configure Secrets

Copy the example secrets file and fill in your credentials:

```bash
cp SharedTodoList/Resources/Secrets.plist.example SharedTodoList/Resources/Secrets.plist
```

Edit `Secrets.plist` with your values:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `API_BASE_URL` - Your web app URL (for AI features)

#### 3. Configure Xcode Signing

1. Open project settings in Xcode
2. Select the **SharedTodoList** target
3. Go to **Signing & Capabilities**
4. Select your Development Team
5. Update Bundle Identifier if needed

### 3. Configure Push Notifications

1. Create an Apple Push Notification key in Apple Developer Portal
2. Add the following environment variables to your Supabase project:
   - `APNS_KEY_ID` - Your APNs key ID
   - `APNS_TEAM_ID` - Your Apple Team ID
   - `APNS_PRIVATE_KEY` - Your APNs private key (p8 file contents)
   - `BUNDLE_ID` - Your app bundle identifier

3. Deploy the Edge Function:
```bash
supabase functions deploy send-push-notification
```

4. Run the database migration:
```bash
supabase db push
```

### 4. Configure App Capabilities

In Xcode, enable these capabilities:

- **Push Notifications**
- **Background Modes**
  - Background fetch
  - Remote notifications
- **App Groups** (for widget data sharing)
  - `group.com.yourcompany.sharedtodolist`

### 5. Install Dependencies

The project uses Swift Package Manager. Dependencies will be resolved automatically when opening in Xcode.

Dependencies:
- [Supabase Swift](https://github.com/supabase/supabase-swift) - Database, Auth, Realtime

## Project Structure

```
SharedTodoList/
├── App/                    # App entry point, delegates
├── Core/
│   ├── Config/            # Configuration constants
│   ├── Extensions/        # Swift extensions
│   └── Utilities/         # Helper classes
├── Data/
│   ├── Models/            # Data models (Todo, User, etc.)
│   ├── Repositories/      # Data access layer
│   ├── Services/          # Business logic services
│   └── Local/             # SwiftData models
├── Features/
│   ├── Auth/              # Login, registration
│   ├── TaskList/          # Main task list
│   ├── TaskDetail/        # Task editing
│   ├── AddTask/           # Task creation
│   ├── Kanban/            # Kanban board view
│   ├── Settings/          # App settings
│   └── Shared/            # Reusable components
├── Widgets/               # Home screen widgets
├── ShareExtension/        # Share extension
├── Intents/               # Siri shortcuts
└── Resources/             # Assets, strings
```

## Architecture

- **MVVM** with SwiftUI
- **@Observable** for state management (iOS 17+)
- **SwiftData** for local persistence
- **Repository Pattern** for data access
- **Dependency Injection** via Environment

## Key Features Implementation

### Real-time Sync

```swift
// Subscribe to changes
let channel = await SupabaseService.shared.subscribeTodos(
    onInsert: { todo in /* handle new task */ },
    onUpdate: { todo in /* handle update */ },
    onDelete: { id in /* handle deletion */ }
)
```

### Offline Support

```swift
// Queue operation when offline
SyncService.shared.queueCreate(todo)
SyncService.shared.queueUpdate(todo)
SyncService.shared.queueDelete(todoId: id)

// Sync when back online (automatic)
await SyncService.shared.syncPendingOperations()
```

### Push Notifications

The app receives push notifications for:
- Task assigned to you
- Task due soon (configurable reminder)
- Overdue tasks

### Biometric Authentication

```swift
// Check availability
if AuthService.shared.biometricsAvailable {
    // Enable Face ID / Touch ID
    try await AuthService.shared.enableBiometrics()
}
```

## Building for Release

1. Update version/build numbers in Xcode
2. Archive the app (Product → Archive)
3. Distribute to App Store Connect
4. Submit for review

## Testing

```bash
# Run unit tests
xcodebuild test -scheme SharedTodoList -destination 'platform=iOS Simulator,name=iPhone 15'

# Run UI tests
xcodebuild test -scheme SharedTodoListUITests -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `API_BASE_URL` | Web app API base URL |
| `APNS_KEY_ID` | Apple Push Notification key ID |
| `APNS_TEAM_ID` | Apple Developer Team ID |
| `APNS_PRIVATE_KEY` | APNs authentication key |
| `BUNDLE_ID` | App bundle identifier |

## License

Private - All rights reserved

## Support

For issues, contact the development team.
