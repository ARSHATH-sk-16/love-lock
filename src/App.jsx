// App.jsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { encryptMessage, decryptMessage, getSharedKey } from "./lib/crypto";
import { motion, AnimatePresence } from "framer-motion";

/* -------------------------
   Avatar (darkMode-aware)
------------------------- */
function Avatar({ email, online = false }) {
  const initials = (email || "?").split("@")[0].slice(0, 2).toUpperCase();
  const hue = (email?.charCodeAt(0) || 0) % 360;
  return (
    <div className="relative">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md"
        style={{ background: `hsl(${hue} 70% 45%)`, color: "white" }}
      >
        {initials}
      </div>
      <span
        className={`absolute -right-1 -bottom-1 w-3 h-3 rounded-full border-2 ${
          online ? "bg-green-400 border-white" : "bg-gray-300 border-white"
        }`}
        title={online ? "Online" : "Offline"}
      />
    </div>
  );
}

/* -------------------------
   Profile Settings Modal
------------------------- */
function SettingsModal({
  me,
  onClose,
  onSaved,
  darkMode,
  partnerEmail,
  onDeleteChat,
  soundOn,
  setSoundOn,
  notifOn,
  setNotifOn,
  toggleDarkMode,
}) {
  const [name, setName] = useState(me?.display_name || "");

  async function save() {
    try {
      const { error } = await supabase
        .from("users")
        .update({ display_name: name })
        .eq("id", me.id);
      if (error) {
        console.warn("Display name update skipped:", error.message);
        alert("Name change needs a 'display_name' column in users table.");
      } else {
        onSaved({ ...me, display_name: name });
        alert("✅ Profile updated");
      }
      onClose();
    } catch (e) {
      console.error(e);
      alert("❌ Failed to update");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative w-full max-w-sm p-6 rounded-2xl shadow-lg ${
          darkMode ? "bg-gray-800 text-white" : "bg-white text-black"
        }`}
      >
        <h3 className="text-lg font-semibold mb-4">Settings</h3>

        <div className="space-y-2 mb-6 text-sm opacity-80">
          <div>Logged in as <strong>{me?.email}</strong></div>
          <div>Partner: <strong>{partnerEmail ? partnerEmail : "Not connected"}</strong></div>
        </div>

        <label className="text-sm mb-1 block">Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kaja 💖"
          className={`w-full px-3 py-2 rounded-xl mb-4 border ${
            darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-black"
          }`}
        />

        {/* Toggles */}
        <div className="space-y-2 mb-4">
          <button
            onClick={toggleDarkMode}
            className="w-full py-2 rounded-xl border hover:opacity-80"
          >
            {darkMode ? "☀️ Switch to Light" : "🌙 Switch to Dark"}
          </button>
          <button
            onClick={() => setSoundOn((s) => !s)}
            className="w-full py-2 rounded-xl border hover:opacity-80"
          >
            {soundOn ? "🔕 Sound Off" : "🔔 Sound On"}
          </button>
          <button
            onClick={async () => {
              if (!notifOn && "Notification" in window && Notification.permission !== "granted") {
                try { await Notification.requestPermission(); } catch {}
              }
              setNotifOn((s) => !s);
            }}
            className="w-full py-2 rounded-xl border hover:opacity-80"
          >
            {notifOn ? "🛑 Disable Desktop Notifications" : "🖥️ Enable Desktop Notifications"}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            className="flex-1 bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className={`flex-1 py-2 rounded-xl border ${
              darkMode ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-100"
            }`}
          >
            Cancel
          </button>
        </div>

        <div className="mt-6 border-t pt-4">
          <button
            onClick={onDeleteChat}
            className="w-full py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
          >
            🗑 Delete Full Chat
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
           App
------------------------- */
export default function App() {
  // Auth + profile state
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null); // row from `users`
  const [partner, setPartner] = useState(null); // row from `users` for partner
  const [partnerEmail, setPartnerEmail] = useState(null);

  // Login forms
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // UI & chat
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("lovelock:dark");
    return saved ? saved === "1" : false;
  });
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("lovelock:sound") !== "0");
  const [notifOn, setNotifOn] = useState(() => localStorage.getItem("lovelock:notif") === "1");
  const [showSettings, setShowSettings] = useState(false);

  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");

  // Realtime channel refs
  const channelRef = useRef(null);
  const chatRef = useRef(null);
  const dingRef = useRef(null);

  // Persist toggles
  useEffect(() => {
    localStorage.setItem("lovelock:dark", darkMode ? "1" : "0");
  }, [darkMode]);
  useEffect(() => {
    localStorage.setItem("lovelock:sound", soundOn ? "1" : "0");
  }, [soundOn]);
  useEffect(() => {
    localStorage.setItem("lovelock:notif", notifOn ? "1" : "0");
  }, [notifOn]);

  // Prepare ding sound and request Notification permission if desired
  useEffect(() => {
    dingRef.current = new Audio("/ding.mp3"); // put ding.mp3 in /public
    dingRef.current.volume = 0.5;
    if (notifOn && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []); // run once

  // Dark mode toggle
  const toggleDarkMode = () => setDarkMode((s) => !s);

  /* -------------------------
        Auth lifecycle
  ------------------------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sess = data?.session || null;
      setSession(sess);
      if (sess?.user) {
        fetchOrCreateUser(sess.user);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          fetchOrCreateUser(newSession.user);
        } else {
          // logout
          cleanupRealtime();
          setMe(null);
          setPartner(null);
          setPartnerEmail(null);
          setMessages([]);
          setLoading(false);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------
   Fetch or create user row
  ------------------------- */
  async function fetchOrCreateUser(authUser) {
    try {
      const { data: existing, error: selErr } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (selErr && selErr.code !== "PGRST116") {
        console.error("Fetch user error:", selErr);
      }

      let row = existing;
      if (!row) {
        const { data: inserted, error: insErr } = await supabase
          .from("users")
          .insert([{ id: authUser.id, email: authUser.email }])
          .select()
          .single();
        if (insErr) {
          console.error("Create user error:", insErr);
        }
        row = inserted || { id: authUser.id, email: authUser.email };
      }

      setMe(row);

      if (row?.partner_id) {
        const { data: p, error: pErr } = await supabase
          .from("users")
          .select("*")
          .eq("id", row.partner_id)
          .single();
        if (!pErr) {
          setPartner(p);
          setPartnerEmail(p.email);
          await loadMessages(row.id, p.id);
          subscribeMessages(row.id, p.id);
        }
      } else {
        cleanupRealtime();
        setPartner(null);
        setPartnerEmail(null);
        setMessages([]);
      }

      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  /* -------------------------
      Pair via invite code
  ------------------------- */
  async function linkPartner() {
    const code = prompt("Enter your partner's invite code");
    if (!code || !me) return;

    try {
      const { data: partnerRow, error: findErr } = await supabase
        .from("users")
        .select("*")
        .eq("invite_code", code)
        .single();

      if (findErr || !partnerRow) {
        alert("❌ Invalid invite code");
        return;
      }

      if (partnerRow.id === me.id) {
        alert("❌ You cannot use your own invite code.");
        return;
      }

      if (partnerRow.partner_id) {
        alert("❌ This invite is already paired.");
        return;
      }

      if (me.partner_id) {
        alert("❌ You are already paired.");
        return;
      }

      const updates = [
        supabase
          .from("users")
          .update({ partner_id: partnerRow.id, invite_code: null })
          .eq("id", me.id),
        supabase
          .from("users")
          .update({ partner_id: me.id, invite_code: null })
          .eq("id", partnerRow.id),
      ];

      const [u1, u2] = await Promise.all(updates);
      if (u1.error || u2.error) {
        console.error("Pairing error:", u1.error || u2.error);
        alert("❌ Pairing failed, try again.");
        return;
      }

      const { data: freshMe } = await supabase
        .from("users")
        .select("*")
        .eq("id", me.id)
        .single();
      const { data: freshPartner } = await supabase
        .from("users")
        .select("*")
        .eq("id", partnerRow.id)
        .single();

      setMe(freshMe);
      setPartner(freshPartner);
      setPartnerEmail(freshPartner.email);

      await loadMessages(freshMe.id, freshPartner.id);
      subscribeMessages(freshMe.id, freshPartner.id);

      alert("✅ Partner linked! Welcome to your Love Lock chat 💖");
    } catch (e) {
      console.error(e);
      alert("❌ Pairing error");
    }
  }

  /* -------------------------
        Messages logic
  ------------------------- */
  async function loadMessages(userId, partnerId) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch messages error:", error);
      setMessages([]);
      return;
    }

    try {
      const key = await getSharedKey(userId, partnerId);
      const decrypted = await Promise.all(
        (data || []).map(async (m) => {
          try {
            const content = await decryptMessage(key, m.content);
            return { ...m, content };
          } catch {
            return { ...m, content: "❌ Failed to decrypt" };
          }
        })
      );
      setMessages(decrypted);

      // mark messages as read for this user using RPC (server side uses auth.uid())
      try {
        await supabase.rpc("mark_messages_as_read");
      } catch (e) {
        console.warn("mark_messages_as_read rpc failed:", e);
      }

      scrollToBottom();
    } catch (e) {
      console.error("Key/Decrypt error:", e);
      setMessages(data || []);
      // still try to mark read even if decryption failed
      try {
        await supabase.rpc("mark_messages_as_read");
      } catch {}
      scrollToBottom();
    }
  }

  function subscribeMessages(userId, partnerId) {
    cleanupRealtime();

    const ch = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new;
          const match =
            (msg.sender_id === userId && msg.receiver_id === partnerId) ||
            (msg.sender_id === partnerId && msg.receiver_id === userId);
          if (!match) return;

          try {
            const key = await getSharedKey(userId, partnerId);
            const content = await decryptMessage(key, msg.content);
            setMessages((prev) => [...prev, { ...msg, content }]);

            // ding + desktop notif only when partner sends
            if (msg.sender_id === partnerId) {
              if (soundOn) {
                try { await dingRef.current?.play(); } catch {}
              }
              if (
                notifOn &&
                "Notification" in window &&
                Notification.permission === "granted"
              ) {
                try {
                  new Notification("💌 Love Lock", {
                    body: content,
                    icon: "/heart-icon.png",
                  });
                } catch {}
              }

              // mark as read (user is viewing) via RPC
              try {
                await supabase.rpc("mark_messages_as_read");
              } catch (e) {
                console.warn("mark_messages_as_read rpc failed:", e);
              }
            }

            scrollToBottom();
          } catch {
            setMessages((prev) => [
              ...prev,
              { ...msg, content: "❌ Failed to decrypt" },
            ]);
            scrollToBottom();
          }
        }
      )
      .subscribe();

    channelRef.current = ch;
  }

  function cleanupRealtime() {
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch {}
      channelRef.current = null;
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const el = chatRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }

  async function sendMessage() {
    if (!newMsg.trim() || !me?.partner_id || !partner?.id) return;
    const plaintext = newMsg.trim();
    setNewMsg(""); // clear input immediately for optimistic UX

    try {
      const key = await getSharedKey(me.id, partner.id);
      const encrypted = await encryptMessage(key, plaintext);

      // insert and return the inserted row (so we can show it immediately with DB id + timestamps)
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          sender_id: me.id,
          receiver_id: partner.id,
          content: encrypted,
        })
        .select()
        .single();

      if (error) {
        console.error("Send error:", error);
        alert("❌ Failed to send. Check DB 'messages' table & RLS.");
        return;
      }

      // Append inserted message with plaintext content so it appears immediately
      const appended = {
        id: inserted.id,
        sender_id: inserted.sender_id,
        receiver_id: inserted.receiver_id,
        content: plaintext,
        created_at: inserted.created_at,
        delivered_at: inserted.delivered_at || inserted.created_at,
        read_at: inserted.read_at || null,
      };
      setMessages((prev) => [...prev, appended]);

      // scroll to bottom
      scrollToBottom();
    } catch (e) {
      console.error("Encrypt/send error:", e);
    }
  }

  async function deleteFullChat() {
    if (!me?.id || !partner?.id) return;
    if (!confirm("Delete the entire chat with your partner? This cannot be undone.")) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_id.eq.${me.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${me.id})`
      );

    if (error) {
      console.error("Delete chat error:", error);
      alert("❌ Failed to delete chat.");
      return;
    }
    setMessages([]);
  }

  async function deleteSingleMessage(id) {
    if (!id) return;
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      console.error("Delete message error:", error);
      alert("❌ Failed to delete message.");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  function copyToClipboard(text) {
    try {
      navigator.clipboard.writeText(text);
      const el = document.createElement("div");
      el.textContent = "Copied ✔";
      el.className =
        "fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg text-sm bg-black/80 text-white";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 800);
    } catch {}
  }

  /* -------------------------
          Auth actions
  ------------------------- */
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) alert(error.message);
  };

  const emailSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);
    if (data?.user) {
      alert("✅ Check your email to confirm your account (if required).");
    }
  };

  const emailLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return alert(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  /* -------------------------
              UI
  ------------------------- */

  // Unauthenticated view (login)
  if (!session) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 ${
          darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-black"
        }`}
      >
        <button
          onClick={toggleDarkMode}
          className="absolute top-4 right-4 px-4 py-2 rounded-xl border"
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>

        <div
          className={`w-full max-w-md rounded-2xl p-6 shadow-lg ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}
        >
          <h1 className="text-2xl font-bold mb-4 text-center">💘 Love Lock</h1>

          <button
            onClick={loginWithGoogle}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold shadow mb-4"
          >
            Continue with Google
          </button>

          <div className="text-center text-sm opacity-70 my-2">or</div>

          <div className="relative mb-2">
            <input
              type="email"
              placeholder="Email"
              className={`w-full px-3 py-2 rounded-xl border ${
                darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-black"
              }`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative mb-3">
            <input
              type={showPw ? "text" : "password"}
              placeholder="Password"
              className={`w-full px-3 py-2 rounded-xl border ${
                darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-black"
              }`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70"
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={emailLogin}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Login
            </button>
            <button
              onClick={emailSignUp}
              className="flex-1 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Still loading profile row
  if (loading || !me) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-black"
        }`}
      >
        Loading profile...
      </div>
    );
  }

  // Not paired yet → show invite code + join field
  if (!me.partner_id) {
    return (
      <div
        className={`min-h-screen p-6 flex flex-col items-center ${
          darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-black"
        }`}
      >
        <button
          onClick={toggleDarkMode}
          className="absolute top-4 right-4 px-4 py-2 rounded-xl border"
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>

        <div
          className={`w-full max-w-md rounded-2xl p-6 shadow-lg mt-10 ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}
        >
          <h2 className="text-xl font-bold mb-2">Link with your partner</h2>
          <p className="text-sm opacity-80 mb-4">
            Share your invite code with your partner, or enter theirs.
          </p>

          <div className="mb-4 p-4 rounded-xl border bg-gradient-to-r from-violet-500/10 to-indigo-500/10">
            <div className="text-sm opacity-70 mb-1">Your invite code</div>
            <div className="text-2xl font-mono font-bold">
              {me.invite_code || "—"}
            </div>
          </div>

          <button
            onClick={linkPartner}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold shadow"
          >
            Enter Partner’s Code
          </button>

          <button
            onClick={signOut}
            className="mt-4 w-full py-2 rounded-xl bg-red-600 text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Helpers: date separators
  const needsSeparator = (prev, current) => {
    if (!prev) return true;
    const a = new Date(prev.created_at);
    const b = new Date(current.created_at);
    return (
      a.getFullYear() !== b.getFullYear() ||
      a.getMonth() !== b.getMonth() ||
      a.getDate() !== b.getDate()
    );
  };
  const formatDay = (d) =>
    new Date(d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  // Paired → main chat UI
  return (
    <div
      className={`min-h-screen p-4 flex flex-col items-center relative ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-black"
      }`}
    >
      <button
        onClick={toggleDarkMode}
        className="absolute top-4 right-4 px-4 py-2 rounded-xl border"
      >
        {darkMode ? "Light Mode" : "Dark Mode"}
      </button>

      <div
        className={`p-6 rounded-2xl shadow-lg w-full max-w-md flex flex-col ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar email={partnerEmail} online />
            <div>
              <div className="font-semibold">
                {partner?.display_name || partnerEmail}
              </div>
              <div className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-500"}`}>
                Your locked chat 💘
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1 border rounded-xl text-sm hover:opacity-80"
            >
              Settings
            </button>
            <button
              onClick={signOut}
              className="px-3 py-1 bg-red-600 text-white rounded-xl text-sm hover:opacity-90"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Chat window */}
        <div
          id="chat"
          ref={chatRef}
          className={`flex-1 overflow-y-auto h-96 border rounded-xl p-3 mb-3 ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <AnimatePresence initial={false}>
            {messages.map((m, idx) => {
              const isMe = m.sender_id === me.id;
              const bubbleClasses = isMe
                ? "bg-gradient-to-r from-blue-500 to-blue-700 text-white"
                : darkMode
                ? "bg-gradient-to-r from-gray-600 to-gray-700 text-white"
                : "bg-gradient-to-r from-gray-200 to-gray-100 text-black";

              const showSep = needsSeparator(messages[idx - 1], m);

              return (
                <div key={m.id || idx}>
                  {showSep && (
                    <div className="flex justify-center my-2">
                      <span
                        className={`px-3 py-1 text-xs rounded-full ${
                          darkMode ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {formatDay(m.created_at)}
                      </span>
                    </div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className={`group flex items-end mb-2 ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    {!isMe && (
                      <div className="mr-2 shrink-0">
                        <Avatar email={partnerEmail} online />
                      </div>
                    )}

                    <div
                      className={`relative p-3 rounded-2xl max-w-xs shadow-md ${bubbleClasses} ${
                        isMe ? "ml-6" : "mr-6"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {m.content}
                      </div>

                      <div
                        className={`text-[10px] mt-2 text-right ${
                          darkMode ? "text-gray-200/80" : "text-gray-600"
                        }`}
                      >
                        {new Date(m.created_at).toLocaleTimeString()}
                      </div>

                      {/* Read / Delivered ticks for own messages */}
                      {isMe && (
                        <div className={`text-[10px] mt-1 text-right ${darkMode ? "text-gray-200/80" : "text-gray-500"}`}>
                          {m.read_at ? (
                            <span className="text-blue-400">✔✔</span>
                          ) : m.delivered_at ? (
                            <span>✔✔</span>
                          ) : (
                            <span>✔</span>
                          )}
                        </div>
                      )}

                      {/* Message actions */}
                      <div
                        className={`absolute -top-2 ${isMe ? "-left-2" : "-right-2"} opacity-0 group-hover:opacity-100 transition`}
                      >
                        <div
                          className={`flex gap-1 px-2 py-1 rounded-lg shadow ${
                            darkMode ? "bg-gray-900/90" : "bg-white/90"
                          }`}
                        >
                          <button
                            title="Copy"
                            onClick={() => copyToClipboard(m.content)}
                            className="text-xs px-2 py-0.5 rounded hover:bg-gray-200/50"
                          >
                            📋
                          </button>
                          {isMe && (
                            <button
                              title="Delete"
                              onClick={() => deleteSingleMessage(m.id)}
                              className="text-xs px-2 py-0.5 rounded hover:bg-red-200/60"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="flex gap-2 items-center">
          <textarea
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            className={`flex-1 resize-none rounded-2xl px-4 py-2 outline-none border ${
              darkMode
                ? "bg-gray-700 text-white border-gray-600 focus:ring-2 focus:ring-blue-500"
                : "bg-white text-black border-gray-300 focus:ring-2 focus:ring-blue-500"
            }`}
          />
          <button
            onClick={sendMessage}
            disabled={!newMsg.trim()}
            className={`px-4 py-2 rounded-2xl text-white shadow ${
              newMsg.trim()
                ? "bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Send
          </button>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          me={me}
          darkMode={darkMode}
          onClose={() => setShowSettings(false)}
          onSaved={setMe}
          partnerEmail={partnerEmail}
          onDeleteChat={deleteFullChat}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
          notifOn={notifOn}
          setNotifOn={setNotifOn}
          toggleDarkMode={toggleDarkMode}
        />
      )}
    </div>
  );
}
