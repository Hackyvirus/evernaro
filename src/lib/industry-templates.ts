import { IndustryCode } from "@prisma/client";

export type IndustryTerminology = {
  customer: string;
  staff: string;
  appointment: string;
  queue: string;
  job: string;
  resource: string;
  deal?: string;
  matter?: string;
  enquiry?: string;
};

export type IndustryFeatures = {
  queue: boolean;
  appointments: boolean;
  services: boolean;
  resources: boolean;
  memberships: boolean;
  packages: boolean;
  vehicles: boolean;
  tables: boolean;
  courses: boolean;
  batches: boolean;
  matters: boolean;
  reviews: boolean;
  jobCards: boolean;
};

export type IndustryWorkflows = {
  queueStatuses: string[];
  appointmentStatuses: string[];
  jobStatuses?: string[];
};

export type IndustryDashboard = {
  nav: string[];
  overviewCards: string[];
};

export type IndustryTemplateConfig = {
  terminology: IndustryTerminology;
  features: IndustryFeatures;
  workflows: IndustryWorkflows;
  dashboard: IndustryDashboard;
  defaultServices: { name: string; durationMin?: number; priceInr?: number; metadata?: Record<string, unknown> }[];
  defaultAutomations: { name: string; trigger: string; actions: unknown[] }[];
};

export type IndustryTemplate = {
  code: IndustryCode;
  name: string;
  description: string;
  config: IndustryTemplateConfig;
};

const defaultAutomations = [
  {
    name: "Appointment reminder",
    trigger: "APPOINTMENT_DUE_SOON",
    actions: [{ type: "SEND_MESSAGE", config: { template: "appointment_reminder" } }],
  },
  {
    name: "Request review after service",
    trigger: "SERVICE_COMPLETED",
    actions: [{ type: "REQUEST_REVIEW", config: { delayHours: 2 } }],
  },
];

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    code: IndustryCode.REAL_ESTATE,
    name: "Real Estate",
    description: "Manage leads, site visits, and deal pipelines.",
    config: {
      terminology: {
        customer: "Lead",
        staff: "Agent",
        appointment: "Site Visit",
        queue: "Walk-ins",
        job: "Deal",
        resource: "Property",
        deal: "Deal",
        enquiry: "Inquiry",
      },
      features: {
        queue: false,
        appointments: true,
        services: true,
        resources: false,
        memberships: false,
        packages: false,
        vehicles: false,
        tables: false,
        courses: false,
        batches: false,
        matters: false,
        reviews: false,
        jobCards: true,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
        queueStatuses: ["WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
        jobStatuses: ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT", "NEGOTIATION", "BOOKED", "CLOSED"],
      },
      dashboard: {
        nav: ["overview", "leads", "siteVisits", "deals", "customers", "inbox", "campaigns", "reminders", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["newLeads", "hotLeads", "followUpsToday", "siteVisitsToday", "closedDeals"],
      },
      defaultServices: [
        { name: "Property Consultation", durationMin: 60, priceInr: 0 },
        { name: "Site Visit", durationMin: 90, priceInr: 0 },
      ],
      defaultAutomations,
    },
  },
  {
    code: IndustryCode.SALON,
    name: "Salon / Beauty",
    description: "Appointments, walk-in queues, stylists, and packages.",
    config: {
      terminology: {
        customer: "Customer",
        staff: "Stylist",
        appointment: "Appointment",
        queue: "Waiting List",
        job: "Service",
        resource: "Chair",
      },
      features: {
        queue: true,
        appointments: true,
        services: true,
        resources: false,
        memberships: true,
        packages: true,
        vehicles: false,
        tables: false,
        courses: false,
        batches: false,
        matters: false,
        reviews: true,
        jobCards: false,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
        queueStatuses: ["WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
      },
      dashboard: {
        nav: ["overview", "queue", "appointments", "customers", "services", "staff", "memberships", "inbox", "reviews", "campaigns", "reminders", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["waiting", "inService", "appointmentsToday", "revenueToday", "noShows"],
      },
      defaultServices: [
        { name: "Haircut", durationMin: 30, priceInr: 300 },
        { name: "Hair Color", durationMin: 90, priceInr: 1500 },
        { name: "Facial", durationMin: 60, priceInr: 800 },
      ],
      defaultAutomations,
    },
  },
  {
    code: IndustryCode.CLINIC,
    name: "Clinic",
    description: "Patient appointments, queues, doctor availability, and follow-ups.",
    config: {
      terminology: {
        customer: "Patient",
        staff: "Doctor",
        appointment: "Appointment",
        queue: "Queue",
        job: "Consultation",
        resource: "Room",
      },
      features: {
        queue: true,
        appointments: true,
        services: true,
        resources: false,
        memberships: false,
        packages: false,
        vehicles: false,
        tables: false,
        courses: false,
        batches: false,
        matters: false,
        reviews: true,
        jobCards: false,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
        queueStatuses: ["WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
      },
      dashboard: {
        nav: ["overview", "appointments", "queue", "customers", "services", "staff", "followUps", "inbox", "reviews", "campaigns", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["appointmentsToday", "waiting", "inProgress", "completed", "noShows", "averageWait"],
      },
      defaultServices: [
        { name: "General Consultation", durationMin: 15, priceInr: 500 },
        { name: "Follow-up Visit", durationMin: 10, priceInr: 300 },
      ],
      defaultAutomations,
    },
  },
  {
    code: IndustryCode.DENTAL,
    name: "Dental Clinic",
    description: "Dental appointments, treatments, and patient follow-ups.",
    config: {
      terminology: {
        customer: "Patient",
        staff: "Dentist",
        appointment: "Appointment",
        queue: "Queue",
        job: "Treatment",
        resource: "Chair",
      },
      features: {
        queue: true,
        appointments: true,
        services: true,
        resources: false,
        memberships: false,
        packages: false,
        vehicles: false,
        tables: false,
        courses: false,
        batches: false,
        matters: false,
        reviews: true,
        jobCards: false,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
        queueStatuses: ["WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
      },
      dashboard: {
        nav: ["overview", "appointments", "queue", "customers", "services", "staff", "followUps", "inbox", "reviews", "campaigns", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["appointmentsToday", "waiting", "inTreatment", "completed", "followUpsDue"],
      },
      defaultServices: [
        { name: "Dental Checkup", durationMin: 30, priceInr: 500 },
        { name: "Teeth Cleaning", durationMin: 45, priceInr: 1200 },
        { name: "Filling", durationMin: 60, priceInr: 2000 },
      ],
      defaultAutomations,
    },
  },
  {
    code: IndustryCode.RESTAURANT,
    name: "Restaurant",
    description: "Table management, reservations, and digital waitlist.",
    config: {
      terminology: {
        customer: "Guest",
        staff: "Host",
        appointment: "Reservation",
        queue: "Waitlist",
        job: "Dining",
        resource: "Table",
      },
      features: {
        queue: true,
        appointments: true,
        services: false,
        resources: true,
        memberships: false,
        packages: false,
        vehicles: false,
        tables: true,
        courses: false,
        batches: false,
        matters: false,
        reviews: true,
        jobCards: false,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"],
        queueStatuses: ["WAITING", "TABLE_READY", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"],
      },
      dashboard: {
        nav: ["overview", "tables", "reservations", "waitlist", "customers", "staff", "reviews", "campaigns", "reminders", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["availableTables", "occupiedTables", "waitingGroups", "averageWait", "todayRevenue"],
      },
      defaultServices: [],
      defaultAutomations,
    },
  },
  {
    code: IndustryCode.AUTO_SERVICE,
    name: "Auto / Bike Service Center",
    description: "Vehicle service tracking, job cards, and technician assignments.",
    config: {
      terminology: {
        customer: "Customer",
        staff: "Technician",
        appointment: "Booking",
        queue: "Service Queue",
        job: "Job Card",
        resource: "Bay",
      },
      features: {
        queue: true,
        appointments: true,
        services: true,
        resources: true,
        memberships: false,
        packages: false,
        vehicles: true,
        tables: false,
        courses: false,
        batches: false,
        matters: false,
        reviews: true,
        jobCards: true,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
        queueStatuses: ["WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
        jobStatuses: ["RECEIVED", "INSPECTION", "ESTIMATE", "APPROVED", "IN_PROGRESS", "QUALITY_CHECK", "READY", "DELIVERED"],
      },
      dashboard: {
        nav: ["overview", "jobs", "vehicles", "queue", "technicians", "customers", "estimates", "reviews", "campaigns", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["vehiclesToday", "waiting", "inService", "qualityCheck", "ready", "delivered"],
      },
      defaultServices: [
        { name: "General Service", durationMin: 120, priceInr: 2500 },
        { name: "Oil Change", durationMin: 30, priceInr: 800 },
      ],
      defaultAutomations,
    },
  },
  {
    code: IndustryCode.HOME_SERVICES,
    name: "Home Services",
    description: "Electrician, plumbing, cleaning, appliance repair dispatch.",
    config: {
      terminology: {
        customer: "Customer",
        staff: "Technician",
        appointment: "Booking",
        queue: "Dispatch Queue",
        job: "Job",
        resource: "Technician",
      },
      features: {
        queue: true,
        appointments: true,
        services: true,
        resources: false,
        memberships: false,
        packages: false,
        vehicles: false,
        tables: false,
        courses: false,
        batches: false,
        matters: false,
        reviews: true,
        jobCards: true,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
        queueStatuses: ["WAITING", "ASSIGNED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
        jobStatuses: ["BOOKED", "ASSIGNED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED"],
      },
      dashboard: {
        nav: ["overview", "bookings", "dispatch", "technicians", "customers", "serviceStatus", "reviews", "campaigns", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["newBookings", "unassigned", "onTheWay", "inProgress", "completed"],
      },
      defaultServices: [
        { name: "AC Repair", durationMin: 90, priceInr: 1500 },
        { name: "Plumbing", durationMin: 60, priceInr: 800 },
        { name: "Electrical", durationMin: 60, priceInr: 700 },
      ],
      defaultAutomations,
    },
  },
  {
    code: IndustryCode.EDUCATION,
    name: "Education / Coaching / Training",
    description: "Enquiries, counselling, admissions, batches, and fee tracking.",
    config: {
      terminology: {
        customer: "Student",
        staff: "Counsellor",
        appointment: "Counselling",
        queue: "Walk-ins",
        job: "Admission",
        resource: "Batch",
        enquiry: "Enquiry",
      },
      features: {
        queue: false,
        appointments: true,
        services: true,
        resources: false,
        memberships: false,
        packages: false,
        vehicles: false,
        tables: false,
        courses: true,
        batches: true,
        matters: false,
        reviews: false,
        jobCards: false,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
        queueStatuses: ["WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
      },
      dashboard: {
        nav: ["overview", "enquiries", "counselling", "admissions", "students", "courses", "batches", "followUps", "inbox", "campaigns", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["newEnquiries", "counsellingToday", "demos", "admissions", "feesPending"],
      },
      defaultServices: [
        { name: "Career Counselling", durationMin: 30, priceInr: 0 },
        { name: "Demo Class", durationMin: 60, priceInr: 0 },
      ],
      defaultAutomations,
    },
  },
  {
    code: IndustryCode.LEGAL,
    name: "Law Firm",
    description: "Client intake, consultations, matters, tasks, and billing.",
    config: {
      terminology: {
        customer: "Client",
        staff: "Lawyer",
        appointment: "Consultation",
        queue: "Walk-ins",
        job: "Matter",
        resource: "Case",
        matter: "Matter",
        enquiry: "Lead",
      },
      features: {
        queue: false,
        appointments: true,
        services: true,
        resources: false,
        memberships: false,
        packages: false,
        vehicles: false,
        tables: false,
        courses: false,
        batches: false,
        matters: true,
        reviews: false,
        jobCards: false,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
        queueStatuses: ["WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
      },
      dashboard: {
        nav: ["overview", "leads", "clients", "matters", "tasks", "appointments", "inbox", "campaigns", "reminders", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["newLeads", "consultations", "activeClients", "overdueFollowUps", "pendingPayments"],
      },
      defaultServices: [
        { name: "Legal Consultation", durationMin: 60, priceInr: 3000 },
        { name: "Document Review", durationMin: 120, priceInr: 5000 },
      ],
      defaultAutomations,
    },
  },
  {
    code: IndustryCode.WELLNESS,
    name: "Wellness / Spa",
    description: "Appointments, memberships, packages, and retention.",
    config: {
      terminology: {
        customer: "Customer",
        staff: "Therapist",
        appointment: "Appointment",
        queue: "Waiting List",
        job: "Service",
        resource: "Room",
      },
      features: {
        queue: true,
        appointments: true,
        services: true,
        resources: false,
        memberships: true,
        packages: true,
        vehicles: false,
        tables: false,
        courses: false,
        batches: false,
        matters: false,
        reviews: true,
        jobCards: false,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
        queueStatuses: ["WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
      },
      dashboard: {
        nav: ["overview", "appointments", "queue", "customers", "services", "staff", "memberships", "packages", "reviews", "inbox", "campaigns", "reminders", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["appointments", "inService", "availableStaff", "memberships", "expiringPackages"],
      },
      defaultServices: [
        { name: "Swedish Massage", durationMin: 60, priceInr: 2500 },
        { name: "Facial", durationMin: 45, priceInr: 1800 },
      ],
      defaultAutomations,
    },
  },
  {
    code: IndustryCode.OTHER,
    name: "Other",
    description: "Generic service business with appointments and queue.",
    config: {
      terminology: {
        customer: "Customer",
        staff: "Staff",
        appointment: "Appointment",
        queue: "Queue",
        job: "Job",
        resource: "Resource",
      },
      features: {
        queue: true,
        appointments: true,
        services: true,
        resources: false,
        memberships: false,
        packages: false,
        vehicles: false,
        tables: false,
        courses: false,
        batches: false,
        matters: false,
        reviews: true,
        jobCards: false,
      },
      workflows: {
        appointmentStatuses: ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
        queueStatuses: ["WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
      },
      dashboard: {
        nav: ["overview", "queue", "appointments", "customers", "services", "staff", "inbox", "reviews", "campaigns", "reminders", "analytics", "locations", "channels", "knowledge", "team", "billing", "settings"],
        overviewCards: ["waiting", "inService", "appointmentsToday", "revenueToday"],
      },
      defaultServices: [],
      defaultAutomations,
    },
  },
];

export function getIndustryTemplate(code: IndustryCode): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find((t) => t.code === code);
}

export function getIndustryTemplateByCode(code: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find((t) => t.code === code);
}
