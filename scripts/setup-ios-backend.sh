#!/bin/bash

# Shared Todo List - iOS Backend Setup Script
# This script sets up the Supabase backend for the iOS app

set -e

echo "🚀 Shared Todo List - iOS Backend Setup"
echo "======================================="
echo ""

# Check for Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Installing..."

    if command -v brew &> /dev/null; then
        brew install supabase/tap/supabase
    elif command -v npm &> /dev/null; then
        npm install -g supabase
    else
        echo "❌ Please install Supabase CLI manually:"
        echo "   https://supabase.com/docs/guides/cli"
        exit 1
    fi
fi

echo "✅ Supabase CLI installed"

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo ""
    echo "📝 Please log in to Supabase:"
    supabase login
fi

echo ""
echo "🔗 Linking to your Supabase project..."
echo ""

# Get project reference
read -p "Enter your Supabase project reference (from Project Settings > General): " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project reference is required"
    exit 1
fi

# Link project
supabase link --project-ref "$PROJECT_REF"

echo ""
echo "📦 Deploying Edge Function for Push Notifications..."
echo ""

# Deploy the edge function
cd "$(dirname "$0")/.."
supabase functions deploy send-push-notification

echo ""
echo "✅ Edge Function deployed!"
echo ""

echo "📊 Running database migration..."
echo ""

# Run the migration
supabase db push

echo ""
echo "✅ Database migration complete!"
echo ""

echo "======================================="
echo "🎉 Setup Complete!"
echo "======================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Set up APNs secrets in Supabase Dashboard:"
echo "   - Go to Project Settings > Edge Functions"
echo "   - Add these secrets:"
echo "     • APNS_KEY_ID"
echo "     • APNS_TEAM_ID"
echo "     • APNS_PRIVATE_KEY"
echo "     • BUNDLE_ID"
echo "     • APNS_ENVIRONMENT (development or production)"
echo ""
echo "2. Copy ios-app/SharedTodoList/Resources/Secrets.plist.example"
echo "   to ios-app/SharedTodoList/Resources/Secrets.plist"
echo "   and fill in your Supabase credentials"
echo ""
echo "3. Open ios-app/SharedTodoList.xcodeproj in Xcode"
echo ""
echo "4. Update your Team and Bundle Identifier in Xcode"
echo ""
echo "5. Build and run on a physical device to test push notifications"
echo ""
