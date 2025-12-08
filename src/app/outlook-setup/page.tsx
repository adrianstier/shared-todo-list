'use client';

import { useState } from 'react';

export default function OutlookSetupPage() {
  const [copied, setCopied] = useState(false);
  const manifestUrl = 'https://shared-todo-list-production.up.railway.app/outlook/manifest.xml';

  const copyManifestUrl = () => {
    navigator.clipboard.writeText(manifestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-[#0033A0] transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Todo List
          </a>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#0033A0] rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              B
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Outlook Add-in Setup</h1>
              <p className="text-slate-600">Convert emails to tasks with AI</p>
            </div>
          </div>
        </div>

        {/* What it does */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">✨</span> What does it do?
          </h2>
          <p className="text-slate-600 mb-4">
            The Bealer Todo Outlook Add-in lets you convert any email into a task with one click.
            Our AI automatically extracts:
          </p>
          <ul className="space-y-2 text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">✓</span>
              <span><strong>Task description</strong> - Clear, actionable task from the email content</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">✓</span>
              <span><strong>Assignee</strong> - Detects who should handle the task (Sefra, Derrick, etc.)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">✓</span>
              <span><strong>Priority</strong> - Identifies urgent vs. low priority requests</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">✓</span>
              <span><strong>Due date</strong> - Parses deadlines like "by Friday" or "end of week"</span>
            </li>
          </ul>
        </div>

        {/* Manifest URL */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Add-in Manifest URL</h2>
          <p className="text-slate-600 text-sm mb-3">You'll need this URL during installation:</p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={manifestUrl}
              className="flex-1 px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm font-mono text-slate-700"
            />
            <button
              onClick={copyManifestUrl}
              className="px-4 py-3 bg-[#0033A0] text-white rounded-xl font-medium hover:bg-[#002580] transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Installation Instructions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Installation Instructions</h2>

          {/* Outlook Web */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </span>
              Outlook on the Web (outlook.com / Microsoft 365)
            </h3>
            <ol className="space-y-4 text-slate-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                <div>
                  <p>Open <a href="https://outlook.office.com" target="_blank" rel="noopener noreferrer" className="text-[#0033A0] hover:underline">outlook.office.com</a> and sign in</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                <div>
                  <p>Click the <strong>Settings</strong> gear icon (top right)</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                <div>
                  <p>Scroll down and click <strong>"View all Outlook settings"</strong></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
                <div>
                  <p>Go to <strong>Mail</strong> → <strong>Customize actions</strong> → <strong>Add-ins</strong></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">5</span>
                <div>
                  <p>Click <strong>"Get add-ins"</strong> button</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">6</span>
                <div>
                  <p>Click <strong>"My add-ins"</strong> in the left sidebar</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">7</span>
                <div>
                  <p>Under "Custom add-ins", click <strong>"Add a custom add-in"</strong> → <strong>"Add from URL"</strong></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">8</span>
                <div>
                  <p>Paste the manifest URL (copied above) and click <strong>OK</strong></p>
                </div>
              </li>
            </ol>
          </div>

          {/* Outlook Desktop Windows */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 12V6.75L9 5.43V11.91L3 12M20 3V11.75L10 11.9V5.21L20 3M3 13L9 13.09V19.9L3 18.75V13M20 13.25V22L10 20.09V13.1L20 13.25Z"/>
                </svg>
              </span>
              Outlook Desktop (Windows)
            </h3>
            <ol className="space-y-4 text-slate-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                <div>
                  <p>Open Outlook and go to <strong>File</strong> menu</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                <div>
                  <p>Click <strong>"Manage Add-ins"</strong> (or <strong>"Get Add-ins"</strong>)</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                <div>
                  <p>Click <strong>"My add-ins"</strong> in the left panel</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
                <div>
                  <p>Under "Custom add-ins", click <strong>"Add a custom add-in"</strong> → <strong>"Add from URL"</strong></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">5</span>
                <div>
                  <p>Paste the manifest URL and click <strong>OK</strong></p>
                </div>
              </li>
            </ol>
          </div>

          {/* Outlook Mac */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 17 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5M13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                </svg>
              </span>
              Outlook for Mac
            </h3>
            <ol className="space-y-4 text-slate-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                <div>
                  <p>Open Outlook and go to the <strong>Home</strong> tab in the ribbon</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                <div>
                  <p>Click <strong>"Get Add-ins"</strong> (or look under the <strong>...</strong> More menu)</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                <div>
                  <p>Click <strong>"My add-ins"</strong></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
                <div>
                  <p>Under "Custom add-ins", click <strong>"Add a custom add-in"</strong> → <strong>"Add from URL"</strong></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-medium">5</span>
                <div>
                  <p>Paste the manifest URL and click <strong>OK</strong></p>
                </div>
              </li>
            </ol>
          </div>
        </div>

        {/* How to Use */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">How to Use</h2>
          <ol className="space-y-4 text-slate-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-[#D4A853] text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <div>
                <p><strong>Open any email</strong> in Outlook that you want to convert to a task</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-[#D4A853] text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <div>
                <p>Click the <strong>"Add to Todo"</strong> button in the ribbon (look for the Bealer Todo icon)</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-[#D4A853] text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <div>
                <p>Click <strong>"Analyze Email with AI"</strong> - the AI will read the email and suggest task details</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-[#D4A853] text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <div>
                <p><strong>Review and edit</strong> the suggested task, assignee, priority, and due date</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-[#D4A853] text-white rounded-full flex items-center justify-center text-sm font-medium">5</span>
              <div>
                <p>Click <strong>"Add Task"</strong> - the task will appear in your todo list instantly!</p>
              </div>
            </li>
          </ol>
        </div>

        {/* Troubleshooting */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-xl">💡</span> Troubleshooting
          </h2>
          <div className="space-y-4 text-slate-600">
            <div>
              <p className="font-medium text-slate-700">Can't find "Add a custom add-in"?</p>
              <p className="text-sm">Your organization may have restricted custom add-ins. Contact your IT administrator to enable custom add-in installation.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Add-in not appearing after installation?</p>
              <p className="text-sm">Try refreshing Outlook or restarting the application. The add-in button appears when you have an email open.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700">Getting an error when adding from URL?</p>
              <p className="text-sm">Make sure you copied the full manifest URL. You can also try downloading the manifest file directly and using "Add from file" instead.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-slate-500 text-sm">
          <p>Need help? Contact your administrator or the Bealer Agency team.</p>
        </div>
      </div>
    </div>
  );
}
