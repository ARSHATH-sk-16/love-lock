import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { encryptMessage, decryptMessage, getSharedKey } from "./lib/crypto";

// Avatar Component
function Avatar({ email }) {
  const initials = email.split("@")[0].slice(0, 2).toUpperCase();
  const color = email.charCodeAt(0) % 360;
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
      style={{ backgroundColor: `hsl(${color}, 70%, 50%)` }}
    >
      {initials}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [partnerEmail, setPartnerEmail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);

  // --------------------------
  // Auth & session handling
  // --------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // --------------------------
  // Fetch profile & partner
  // --------------------------
  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("❌ Fetch profile error:", error.message);
      return;
    }

    setProfile(data);

    if (data.partner_id) {
      const { data: partnerData } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", data.partner_id)
        .single();
      setPartnerEmail(partnerData?.email || null);

      fetchMessages(data.id, data.partner_id);
      subscribeMessages(data.id, data.partner_id);
      subscribeTyping(data.id, data.partner_id);
    }
  }

  // --------------------------
  // Partner linking
  // --------------------------
  async function linkPartner() {
    const code = prompt("Enter your partner's invite code");
    if (!code) return;

    const { data: partner, error: findError } = await supabase
      .from("profiles")
      .select("id, partner_id")
      .eq("invite_code", code)
      .single();

    if (findError || !partner) return alert("❌ Invalid invite code");
    if (partner.partner_id) return alert("❌ This user is already paired");

    await Promise.all([
      supabase.from("profiles").update({ partner_id: partner.id }).eq("id", profile.id),
      supabase.from("profiles").update({ partner_id: profile.id }).eq("id", partner.id),
    ]);

    alert("✅ Partner linked successfully!");
    fetchProfile(profile.id);
  }

  // --------------------------
  // Messages & realtime
  // --------------------------
  async function fetchMessages(userId, partnerId) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`
      )
      .order("created_at", { ascending: true });

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

    // Mark all received messages as read
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("receiver_id", userId)
      .eq("is_read", false);
  }

  function subscribeMessages(userId, partnerId) {
    supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new;
          if (
            (msg.sender_id === userId && msg.receiver_id === partnerId) ||
            (msg.sender_id === partnerId && msg.receiver_id === userId)
          ) {
            const key = await getSharedKey(userId, partnerId);
            try {
              const decrypted = await decryptMessage(key, msg.content);
              setMessages((prev) => [...prev, { ...msg, content: decrypted }]);
            } catch {
              setMessages((prev) => [...prev, { ...msg, content: "❌ Failed to decrypt" }]);
            }
          }
        }
      )
      .subscribe();
  }

  // --------------------------
  // Typing indicator
  // --------------------------
  function handleTyping() {
    supabase.from("typing_status").upsert({ user_id: profile.id, is_typing: true });
    setTimeout(() => {
      supabase.from("typing_status").upsert({ user_id: profile.id, is_typing: false });
    }, 2000);
  }

  function subscribeTyping(userId, partnerId) {
    supabase
      .from(`typing_status:user_id=eq.${partnerId}`)
      .on("UPDATE", (payload) => setTyping(payload.new.is_typing))
      .subscribe();
  }

  // --------------------------
  // Send message
  // --------------------------
  async function sendMessage() {
    if (!newMsg.trim() || !profile.partner_id) return;

    try {
      const key = await getSharedKey(profile.id, profile.partner_id);
      const encrypted = await encryptMessage(key, newMsg);

      await supabase.from("messages").insert({
        sender_id: profile.id,
        receiver_id: profile.partner_id,
        content: encrypted,
      });

      setNewMsg("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  }

  // --------------------------
  // Auth functions (updated magic link)
  // --------------------------
  async function signInWithEmail() {
    if (!email) return alert("Enter an email first!");
    setLoading(true);

    try {
      const redirectUrl =
        window.location.hostname === "localhost"
          ? "http://localhost:5173"
          : "https://love-lock-xi.vercel.app";

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectUrl },
      });

      if (error) throw error;
      alert("✅ Check your email for the magic link!");
    } catch (err) {
      console.error("Magic link error:", err.message);
      alert("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setPartnerEmail(null);
    setMessages([]);
  }

  // --------------------------
  // Auto-scroll on new message
  // --------------------------
  useEffect(() => {
    const chatDiv = document.getElementById("chat");
    if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight;
  }, [messages]);

  // --------------------------
  // Render
  // --------------------------
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
        <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-4 text-center">💘 Love Lock Login</h1>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-lg mb-4"
          />
          <button
            onClick={signInWithEmail}
            className="w-full bg-black text-white py-3 rounded-xl"
            disabled={loading}
          >
            {loading ? "Sending magic link..." : "Send Magic Link"}
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return <p className="p-4">Loading profile...</p>;

  if (!partnerEmail) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg max-w-md mx-auto mt-12 text-center">
        <h2 className="text-xl font-bold mb-4">Link with a partner first</h2>
        <p>Your invite code: <b>{profile.invite_code}</b></p>
        <button
          onClick={linkPartner}
          className="mt-4 w-full bg-black text-white py-3 rounded-xl"
        >
          Link Partner
        </button>
        <button
          onClick={signOut}
          className="mt-4 w-full bg-red-500 text-white py-3 rounded-xl"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md flex flex-col">
        <h1 className="text-2xl font-bold mb-2">Chat with {partnerEmail}</h1>
        <div id="chat" className="flex-1 overflow-y-auto h-80 border rounded-xl p-3 mb-3">
          {messages.map((m) => (
            <div key={m.id} className="flex items-end mb-2">
              {m.sender_id !== profile.id && <Avatar email={partnerEmail} />}
              <div className={`ml-2 p-2 rounded-xl max-w-xs ${m.sender_id === profile.id ? "bg-blue-500 text-white ml-auto" : "bg-gray-200 text-black"}`}>
                <div>{m.content}</div>
                <div className="text-xs text-gray-500 text-right">
                  {new Date(m.created_at).toLocaleTimeString()}
                </div>
                {m.sender_id === profile.id && (
                  <div className="text-xs text-gray-300 text-right">{m.is_read ? "✔✔" : "✔"}</div>
                )}
              </div>
            </div>
          ))}
          {typing && <p className="text-gray-500 text-sm">Partner is typing...</p>}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-xl px-3 py-2 outline-none"
            placeholder="Type a message..."
            value={newMsg}
            onChange={(e) => { setNewMsg(e.target.value); handleTyping(); }}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            className="bg-black text-white px-4 py-2 rounded-xl"
            onClick={sendMessage}
          >
            Send
          </button>
        </div>

        <button
          className="mt-4 bg-red-500 text-white py-2 rounded-xl"
          onClick={signOut}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
