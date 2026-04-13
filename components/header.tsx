"use client";

import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Header() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  }

  return (
    <header>
      <nav className="text-[#D8D78F] bg-[#aa5042] py-2 flex flex-1 items-center">
        <div className="flex justify-start ml-4">
          <Link href="/">Home</Link>
        </div>
        <div className="flex flex-1 justify-end mr-4">
          {user ? (
            <button onClick={handleSignOut}>Log Out</button>
          ) : (
            <Link href="/login">Log In</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
