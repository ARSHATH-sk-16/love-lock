import { useState } from "react";

export default function App() {
  const [signedIn, setSignedIn] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center">💘 Love Lock</h1>
        <p className="text-center text-sm text-gray-600 mt-1">
          A private, one-to-one secure chat
        </p>

        {!signedIn ? (
          <div className="mt-6 space-y-3">
            <button
              onClick={() => alert('Auth coming Day 3 🙂')}
              className="w-full rounded-xl py-3 border hover:bg-gray-50 transition"
            >
              Continue with Google
            </button>
            <button
              onClick={() => alert('Email login coming Day 3 🙂')}
              className="w-full rounded-xl py-3 border hover:bg-gray-50 transition"
            >
              Sign in with Email
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <div className="rounded-xl border p-4 h-80 overflow-y-auto">
              {/* Chat messages will go here */}
              <p className="text-gray-500 text-sm">No messages yet.</p>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 rounded-xl border px-3 py-2 outline-none"
                placeholder="Type a message..."
              />
              <button className="rounded-xl px-4 py-2 bg-black text-white">
                Send
              </button>
            </div>
          </div>
        )}

        <div className="text-xs text-center text-gray-400 mt-6">
          Day 1: Scaffold ready
        </div>
      </div>
    </div>
  );
}
