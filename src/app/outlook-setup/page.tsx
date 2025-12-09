'use client';

import { useState } from 'react';

export default function OutlookSetupPage() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingDesktop, setDownloadingDesktop] = useState(false);
  const [outlookVersion, setOutlookVersion] = useState<'new' | 'classic' | null>(null);
  const manifestUrl = 'https://shared-todo-list-production.up.railway.app/outlook/manifest.xml';
  const desktopManifestUrl = 'https://shared-todo-list-production.up.railway.app/outlook/manifest-desktop.xml';

  const copyManifestUrl = () => {
    navigator.clipboard.writeText(manifestUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const downloadManifest = async () => {
    setDownloading(true);
    try {
      const response = await fetch(manifestUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bealer-todo-manifest.xml';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(manifestUrl, '_blank');
    }
    setDownloading(false);
  };

  const downloadDesktopManifest = async () => {
    setDownloadingDesktop(true);
    try {
      const response = await fetch(desktopManifestUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bealer-todo-manifest-desktop.xml';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(desktopManifestUrl, '_blank');
    }
    setDownloadingDesktop(false);
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
            <div className="w-16 h-16 bg-[#0033A0] rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Outlook Add-in Setup</h1>
              <p className="text-slate-600">Turn emails into tasks in seconds</p>
            </div>
          </div>
        </div>

        {/* Quick Overview - Condensed */}
        <div className="bg-gradient-to-r from-[#0033A0] to-[#0055D4] rounded-2xl shadow-lg p-6 mb-6 text-white">
          <h2 className="text-xl font-semibold mb-3">How It Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm opacity-90">Open email</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm opacity-90">Click analyze</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm opacity-90">Review task</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-sm opacity-90">Add to list</span>
            </div>
          </div>
        </div>

        {/* AI extracts info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
          <p className="text-slate-600 text-sm text-center">
            AI automatically extracts <strong>task description</strong>, <strong>assignee</strong>, <strong>priority</strong>, and <strong>due date</strong> from your emails
          </p>
        </div>

        {/* Step 1: Which Outlook? */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
            Which Outlook do you use?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setOutlookVersion('new')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                outlookVersion === 'new'
                  ? 'border-[#0033A0] bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#0033A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Web or New Outlook</p>
                  <p className="text-xs text-slate-500">outlook.com, new app</p>
                </div>
                {outlookVersion === 'new' && (
                  <svg className="w-5 h-5 text-[#0033A0] ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
            <button
              onClick={() => setOutlookVersion('classic')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                outlookVersion === 'classic'
                  ? 'border-[#0033A0] bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Classic Desktop</p>
                  <p className="text-xs text-slate-500">Traditional Outlook app</p>
                </div>
                {outlookVersion === 'classic' && (
                  <svg className="w-5 h-5 text-[#0033A0] ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          </div>
          {!outlookVersion && (
            <p className="text-xs text-slate-500 mt-3 text-center">
              Not sure? If you use Outlook in a web browser or the newer-looking app, choose &quot;Web or New Outlook&quot;
            </p>
          )}
        </div>

        {/* Step 2: Download - Only shows after selection */}
        {outlookVersion && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
              Download the Add-in File
            </h2>
            <button
              onClick={outlookVersion === 'new' ? downloadManifest : downloadDesktopManifest}
              disabled={outlookVersion === 'new' ? downloading : downloadingDesktop}
              className="w-full px-4 py-4 bg-[#0033A0] text-white rounded-xl font-medium hover:bg-[#002580] transition-colors flex items-center justify-center gap-3 disabled:opacity-50 text-lg"
            >
              {(outlookVersion === 'new' ? downloading : downloadingDesktop) ? (
                <>
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Add-in File
                </>
              )}
            </button>
            <p className="text-xs text-slate-500 mt-3 text-center">
              Save this file somewhere you can find it (like Downloads or Desktop)
            </p>
          </div>
        )}

        {/* Step 3: Installation Instructions */}
        {outlookVersion && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-[#0033A0] text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
              Install in Outlook
            </h2>

            {/* Primary installation method */}
            <div className="mb-4">
              <a
                href="https://aka.ms/olksideload"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors text-center text-lg"
              >
                Open Outlook Add-ins Page →
              </a>
              <p className="text-xs text-slate-500 mt-2 text-center">
                This link opens the Add-ins manager in Outlook
              </p>
            </div>

            {/* Simple steps */}
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Then follow these steps:</p>
              <ol className="space-y-2 text-slate-600 text-sm">
                <li className="flex gap-2">
                  <span className="font-bold text-[#0033A0]">A.</span>
                  <span>Click <strong>&quot;My add-ins&quot;</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[#0033A0]">B.</span>
                  <span>Scroll down to <strong>&quot;Custom Addins&quot;</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[#0033A0]">C.</span>
                  <span>Click <strong>&quot;Add a custom add-in&quot;</strong> → <strong>&quot;Add from File...&quot;</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[#0033A0]">D.</span>
                  <span>Select the file you downloaded and click <strong>Install</strong></span>
                </li>
              </ol>
            </div>

            {/* Success message */}
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Once installed, the add-in syncs across all your Outlook apps automatically!</span>
            </div>
          </div>
        )}

        {/* Using the Add-in - Always visible */}
        <div className="bg-[#D4A853]/10 border border-[#D4A853]/30 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-xl">📧</span> Using the Add-in
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-white rounded-xl p-4">
              <div className="w-12 h-12 bg-[#D4A853]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-xl">1</span>
              </div>
              <p className="text-sm text-slate-600">Open an email and click <strong>&quot;Bealer Todo&quot;</strong> in the toolbar</p>
            </div>
            <div className="bg-white rounded-xl p-4">
              <div className="w-12 h-12 bg-[#D4A853]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-xl">2</span>
              </div>
              <p className="text-sm text-slate-600">Click <strong>&quot;Analyze Email&quot;</strong> to extract task details</p>
            </div>
            <div className="bg-white rounded-xl p-4">
              <div className="w-12 h-12 bg-[#D4A853]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-xl">3</span>
              </div>
              <p className="text-sm text-slate-600">Review, edit if needed, and click <strong>&quot;Add Task&quot;</strong></p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 text-center">
            Tip: On Outlook web, find the add-in under the <strong>...</strong> (More actions) menu
          </p>
        </div>

        {/* Troubleshooting - Collapsible */}
        <details className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6">
          <summary className="p-4 cursor-pointer font-semibold text-slate-800 hover:bg-slate-50 rounded-2xl flex items-center gap-2">
            <span className="text-lg">❓</span> Having trouble? Click here for help
          </summary>
          <div className="px-4 pb-4 space-y-3 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-700">Can&apos;t find &quot;Add a custom add-in&quot;?</p>
              <p className="text-slate-500 mt-1">Your organization may have disabled this. Ask IT to enable custom add-ins.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-700">Button not showing up?</p>
              <p className="text-slate-500 mt-1">Make sure you have an email open (not just selected). Try refreshing Outlook.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-700">Need to remove it?</p>
              <p className="text-slate-500 mt-1">Go to <a href="https://aka.ms/olksideload" target="_blank" rel="noopener noreferrer" className="text-[#0033A0] hover:underline">aka.ms/olksideload</a>, find it under Custom Add-ins, and click Remove.</p>
            </div>
          </div>
        </details>

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm">
          <p>Questions? Contact the Bealer Agency team for help.</p>
        </div>
      </div>
    </div>
  );
}
