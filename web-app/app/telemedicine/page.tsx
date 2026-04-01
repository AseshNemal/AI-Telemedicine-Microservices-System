"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  createTelemedicineRoom,
  createTelemedicineToken,
  TelemedicineRoomResponse,
  TelemedicineTokenResponse,
} from "@/app/lib/api";

export default function TelemedicinePage() {
  const [roomName, setRoomName] = useState("appointment-demo-room");
  const [identity, setIdentity] = useState("patient-demo");
  const [participantName, setParticipantName] = useState("Demo Patient");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<TelemedicineRoomResponse | null>(null);
  const [tokenResult, setTokenResult] = useState<TelemedicineTokenResponse | null>(null);

  const metadata = useMemo(() => JSON.stringify({ source: "web-app", role: "PATIENT" }), []);

  async function onCreateRoom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setTokenResult(null);
    setCreatingRoom(true);

    try {
      const result = await createTelemedicineRoom({
        roomName,
        emptyTimeout: 600,
        maxParticipants: 2,
        metadata,
      });
      setRoom(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setCreatingRoom(false);
    }
  }

  async function onCreateToken() {
    setError(null);
    setCreatingToken(true);

    try {
      const result = await createTelemedicineToken({
        roomName,
        participantIdentity: identity,
        participantName,
        metadata,
        ttlSeconds: 3600,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      setTokenResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreatingToken(false);
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-180px)] w-full max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <section className="surface-card">
        <p className="section-kicker">Telemedicine</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Connect to telemedicine service</h1>
        <p className="mt-2 text-sm text-slate-600">
          This page connects to the telemedicine microservice on <strong>/telemedicine/rooms</strong> and <strong>/telemedicine/token</strong>.
        </p>

        <form onSubmit={onCreateRoom} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Room name
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="field-input mt-1"
              required
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Participant identity
            <input
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              className="field-input mt-1"
              required
            />
          </label>

          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Participant name
            <input
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              className="field-input mt-1"
              required
            />
          </label>

          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button type="submit" className="btn-primary" disabled={creatingRoom}>
              {creatingRoom ? "Creating room..." : "Create Room"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onCreateToken}
              disabled={creatingToken}
            >
              {creatingToken ? "Generating token..." : "Generate Participant Token"}
            </button>
          </div>
        </form>

        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {room && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Room created</p>
            <p className="mt-1">Name: {room.name}</p>
            <p>SID: {room.sid}</p>
          </div>
        )}

        {tokenResult && (
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
            <p className="font-semibold">Participant token generated</p>
            <p className="mt-1 break-all">WebSocket URL: {tokenResult.wsUrl}</p>
            <p className="mt-1 break-all">Token: {tokenResult.token}</p>
            <p className="mt-1">Expires in: {tokenResult.expiresInSeconds}s</p>
          </div>
        )}
      </section>
    </main>
  );
}
