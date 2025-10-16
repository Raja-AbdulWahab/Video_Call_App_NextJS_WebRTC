"use client";
import React from "react";

export default function UserList({ users, username, onCall }: { users: string[]; username: string; onCall: (u: string) => void }) {
  return (
    <div className="p-3 bg-gray-50 rounded">
      <div className="font-medium mb-2">Users</div>
      <ul className="space-y-2">
        {users.filter(u => u !== username).map(u => (
          <li key={u} className="flex justify-between items-center">
            <span>{u}</span>
            <button onClick={() => onCall(u)} className="small-btn">Call</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
