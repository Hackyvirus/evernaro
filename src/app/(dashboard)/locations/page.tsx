"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus, Trash2, Star } from "lucide-react";
import React from "react";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { RoleAwareAdminGuard } from "../role";

interface Location {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export default function LocationsPage() {
  return (
    <RoleAwareAdminGuard>
      <LocationsPageContent />
    </RoleAwareAdminGuard>
  );
}

function LocationsPageContent() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchLocations() {
    const res = await fetch("/api/locations");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Failed to load locations");
    return data.locations ?? [];
  }

  async function refresh() {
    try {
      const locations = await fetchLocations();
      setLocations(locations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load locations");
    }
  }

  useEffect(() => {
    fetchLocations()
      .then(setLocations)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load locations"))
      .finally(() => setLoading(false));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: address || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add location");
      setName("");
      setAddress("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add location");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Deactivate this location?")) return;
    try {
      const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to deactivate location");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate location");
    }
  }

  async function setDefault(id: string) {
    try {
      const res = await fetch(`/api/locations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to set default location");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default location");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader title="Locations" description="Manage branches or outlets for your business." />
      <div className="px-6 py-4">
        {error && <div className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</div>}
        <Card className="mb-6 p-4">
          <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-text">Location name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Koramangala branch" />
            </div>
            <div className="flex-[2]">
              <label className="mb-1 block text-sm font-medium text-text">Address</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" />
            </div>
            <Button type="submit" loading={saving}>
              <Plus className="mr-1.5 h-4 w-4" /> Add location
            </Button>
          </form>
        </Card>

        {loading ? (
          <p className="text-text-secondary">Loading locations...</p>
        ) : locations.length === 0 ? (
          <Card className="p-6 text-center text-text-secondary">No locations yet. Add your first branch above.</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => (
              <Card key={loc.id} className="p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-text">{loc.name}</p>
                  </div>
                  {loc.isDefault && <span className="text-xs font-medium text-success">Default</span>}
                </div>
                {loc.address && <p className="mb-3 text-sm text-text-secondary">{loc.address}</p>}
                <div className="flex items-center gap-2">
                  {!loc.isDefault && (
                    <Button size="sm" variant="secondary" onClick={() => setDefault(loc.id)}>
                      <Star className="mr-1.5 h-4 w-4" /> Set default
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(loc.id)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Deactivate
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
