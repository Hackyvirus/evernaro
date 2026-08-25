"use client";

import { useEffect, useState } from "react";
import { Plus, X, Save, HelpCircle, Package, Shield, Bot } from "lucide-react";
import { Button, Card, EmptyState, Input, PageHeader, PhoneInput, Select, Tabs, Textarea, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { VERTICAL_PRESETS } from "@/lib/vertical-presets";
import { RoleAwareAdminGuard } from "../role";

interface FAQ { question: string; answer: string; }
interface Product { name: string; description: string; price: string; availability: string; terms: string; }
interface Policy { title: string; body: string; }
interface AIInstructions { neverSay: string; escalate: string; }

export default function KnowledgePage() {
  return (
    <RoleAwareAdminGuard>
      <KnowledgePageContent />
    </RoleAwareAdminGuard>
  );
}

function KnowledgePageContent() {
  const { showToast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Business profile fields
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [tone, setTone] = useState("");
  const [formality, setFormality] = useState("semi-formal");
  const [language, setLanguage] = useState("en");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [signOff, setSignOff] = useState("");

  // Structured content
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [aiNeverSay, setAiNeverSay] = useState("");
  const [aiEscalate, setAiEscalate] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await fetch("/api/business-profile");
        const d = await r.json();
        const p = d.profile;
        if (active) {
          if (p) {
            setBusinessName(p.businessName ?? "");
            setIndustry(p.industry ?? "");
            setDescription(p.description ?? "");
            setAddress(p.address ?? "");
            setPhone(p.phone ?? "");
            setWebsite(p.website ?? "");
            setWorkingHours(p.workingHours ?? "");
            setTone(p.tone ?? "");
            setFormality(p.formality ?? "semi-formal");
            setLanguage(p.language ?? "en");
            setKnowledgeBase(p.knowledgeBase ?? "");
            setSignOff(p.signOff ?? "");
            setFaqs((p.faqs as FAQ[]) ?? []);
            setProducts((p.products as Product[]) ?? []);
            setPolicies((p.policies as Policy[]) ?? []);
            const ai = (p.aiInstructions as AIInstructions) ?? {};
            setAiNeverSay(ai.neverSay ?? "");
            setAiEscalate(ai.escalate ?? "");
          }
        }
      } catch {
        showToast("error", "Failed to load knowledge base");
      } finally {
        if (active) setLoaded(true);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [showToast]);

  function applyPreset(key: string) {
    const preset = VERTICAL_PRESETS.find((p) => p.id === key);
    if (!preset) return;
    setDescription(preset.businessProfile.description);
    setTone(preset.businessProfile.tone);
    setSignOff(preset.businessProfile.signOff);
    setKnowledgeBase(preset.businessProfile.knowledgeBase);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/business-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName || "My business",
          industry,
          description,
          address,
          phone,
          website,
          workingHours,
          tone,
          formality,
          language,
          knowledgeBase,
          faqs,
          products,
          policies,
          aiInstructions: { neverSay: aiNeverSay, escalate: aiEscalate },
          signOff,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to save");
        return;
      }
      showToast("success", "Knowledge base saved");
    } catch {
      showToast("error", "Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader title="Knowledge Base" description="Loading..." />
        <div className="space-y-4 p-6">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const profileTab = (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={industry} onChange={(e) => { setIndustry(e.target.value); applyPreset(e.target.value); }} className="sm:w-64">
          <option value="">Select a vertical preset...</option>
          {VERTICAL_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </Select>
        <p className="text-xs text-text-muted">Presets fill tone, description, and knowledge base for your industry.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        <PhoneInput label="Phone" value={phone} onChange={setPhone} />
        <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
        <Input label="Working hours" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder="e.g. MonSat 9am7pm" />
      </div>
      <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
      <Textarea label="Free-form knowledge base" value={knowledgeBase} onChange={(e) => setKnowledgeBase(e.target.value)} rows={8} hint="FAQs, pricing, policies — anything the AI should know when drafting replies." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input label="Tone" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="friendly and professional" />
        <Select label="Formality" value={formality} onChange={(e) => setFormality(e.target.value)}>
          <option value="casual">Casual</option>
          <option value="semi-formal">Semi-formal</option>
          <option value="formal">Formal</option>
        </Select>
        <Input label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en" />
      </div>
      <Input label="Sign-off" value={signOff} onChange={(e) => setSignOff(e.target.value)} placeholder="Best, Team Evernaro" />
    </div>
  );

  const faqTab = (
    <div className="space-y-4">
      {faqs.length === 0 && <EmptyState icon={HelpCircle} title="No FAQs yet" description="Add common questions so the AI can answer them consistently." compact />}
      {faqs.map((f, i) => (
        <Card key={i} className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <Input
              value={f.question}
              onChange={(e) => setFaqs((prev) => prev.map((p, idx) => idx === i ? { ...p, question: e.target.value } : p))}
              placeholder="Question"
              className="flex-1"
            />
            <Button size="sm" variant="ghost" onClick={() => setFaqs((prev) => prev.filter((_, idx) => idx !== i))}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Textarea
            value={f.answer}
            onChange={(e) => setFaqs((prev) => prev.map((p, idx) => idx === i ? { ...p, answer: e.target.value } : p))}
            placeholder="Answer"
            rows={3}
          />
        </Card>
      ))}
      <Button variant="secondary" onClick={() => setFaqs((prev) => [...prev, { question: "", answer: "" }])}>
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Add FAQ
      </Button>
    </div>
  );

  const productTab = (
    <div className="space-y-4">
      {products.length === 0 && <EmptyState icon={Package} title="No products or services" description="Add what you sell so the AI can reference prices and availability." compact />}
      {products.map((p, i) => (
        <Card key={i} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <Input
            value={p.name}
            onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
            placeholder="Name"
          />
          <Input
            value={p.price}
            onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))}
            placeholder="Price"
          />
          <Input
            value={p.availability}
            onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, availability: e.target.value } : x))}
            placeholder="Availability"
          />
          <Input
            value={p.terms}
            onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, terms: e.target.value } : x))}
            placeholder="Terms"
          />
          <Textarea
            value={p.description}
            onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
            placeholder="Description"
            rows={2}
            className="sm:col-span-2"
          />
          <div className="flex justify-end sm:col-span-2">
            <Button size="sm" variant="ghost" onClick={() => setProducts((prev) => prev.filter((_, idx) => idx !== i))}>
              <X className="mr-1.5 h-4 w-4" aria-hidden="true" /> Remove
            </Button>
          </div>
        </Card>
      ))}
      <Button variant="secondary" onClick={() => setProducts((prev) => [...prev, { name: "", description: "", price: "", availability: "", terms: "" }])}>
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Add product/service
      </Button>
    </div>
  );

  const policyTab = (
    <div className="space-y-4">
      {policies.length === 0 && <EmptyState icon={Shield} title="No policies" description="Add refund, cancellation, delivery, and privacy policies." compact />}
      {policies.map((p, i) => (
        <Card key={i} className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <Input
              value={p.title}
              onChange={(e) => setPolicies((prev) => prev.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))}
              placeholder="Policy title"
              className="flex-1"
            />
            <Button size="sm" variant="ghost" onClick={() => setPolicies((prev) => prev.filter((_, idx) => idx !== i))}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Textarea
            value={p.body}
            onChange={(e) => setPolicies((prev) => prev.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x))}
            placeholder="Policy details"
            rows={4}
          />
        </Card>
      ))}
      <Button variant="secondary" onClick={() => setPolicies((prev) => [...prev, { title: "", body: "" }])}>
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Add policy
      </Button>
    </div>
  );

  const aiTab = (
    <div className="space-y-4">
      <Card className="border-info bg-info/5 p-4">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-5 w-5 text-info" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-text">AI behavior guardrails</p>
            <p className="text-xs text-text-secondary">These instructions shape how the AI drafts replies and when it asks for human help.</p>
          </div>
        </div>
      </Card>
      <Textarea
        label="What the AI should never say"
        value={aiNeverSay}
        onChange={(e) => setAiNeverSay(e.target.value)}
        rows={4}
        placeholder="Never promise discounts without approval. Never share customer data."
      />
      <Textarea
        label="When to escalate to a human"
        value={aiEscalate}
        onChange={(e) => setAiEscalate(e.target.value)}
        rows={4}
        placeholder="Escalate when a customer is angry, requests a refund, or asks about legal/compliance matters."
      />
    </div>
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Knowledge Base"
        description="Teach the AI about your business so every draft is accurate and on-brand."
      >
        <Button onClick={save} loading={saving}>
          <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Save
        </Button>
      </PageHeader>

      <div className="p-6">
        <Tabs
          tabs={[
            { id: "profile", label: "Business profile", content: profileTab },
            { id: "faqs", label: "FAQs", content: faqTab },
            { id: "products", label: "Products", content: productTab },
            { id: "policies", label: "Policies", content: policyTab },
            { id: "ai", label: "AI instructions", content: aiTab },
          ]}
        />
      </div>
    </div>
  );
}
