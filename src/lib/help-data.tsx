import {
  BookOpen,
  Building2,
  CalendarDays,
  MessageCircle,
  Inbox,
  Bot,
  Bell,
  Globe,
  CreditCard,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface HelpSection {
  title: string;
  content: React.ReactNode;
  screenshot?: string;
  screenshotCaption?: string;
}

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  readingTime: string;
  sections: HelpSection[];
  related: string[];
  keywords: string[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Create your account, verify your email, and set up your first business on Evernaro.",
    icon: BookOpen,
    readingTime: "4 min",
    keywords: ["signup", "login", "verify", "setup", "account", "dashboard"],
    related: ["business-setup", "services-appointments", "channels"],
    sections: [
      {
        title: "What is Evernaro?",
        content: (
          <>
            <p>
              Evernaro is a multi-channel customer communication and appointment-management platform built for
              Indian businesses such as salons, clinics, restaurants, auto-service centers, and more.
            </p>
            <p>It helps you:</p>
            <ul>
              <li>Manage appointments, queues, and customer flow in one place.</li>
              <li>Talk to customers on WhatsApp, Email, Telegram, Instagram, and voice calls.</li>
              <li>Automate reminders, follow-ups, and review requests.</li>
              <li>Use AI-drafted replies while staying in full control of every message.</li>
            </ul>
          </>
        ),
      },
      {
        title: "Create your account",
        screenshot: "signup.png",
        screenshotCaption: "The Evernaro sign-up page where you create your business account.",
        content: (
          <>
            <ol>
              <li>Open <strong>/signup</strong> from the Evernaro homepage.</li>
              <li>Enter your business name, your name, email, and a secure password.</li>
              <li>Select the industry that best matches your business (for example, Salon & Beauty).</li>
              <li>Submit the form. Evernaro creates your organization and your owner account in one step.</li>
            </ol>
            <p>
              <strong>Tip:</strong> Use a business email you can access. You will need it to verify your account.
            </p>
          </>
        ),
      },
      {
        title: "Verify your email",
        screenshot: "login.png",
        screenshotCaption: "The login page. Some features stay limited until your email is verified.",
        content: (
          <>
            <p>
              After signing up, Evernaro sends a verification email to the address you provided. Click the link in
              that email to activate your account.
            </p>
            <p>If you do not see the email:</p>
            <ul>
              <li>Check your spam or promotions folder.</li>
              <li>Log in and click <strong>Resend verification email</strong> from the banner at the top of the dashboard.</li>
            </ul>
            <p>
              <strong>Note:</strong> Several features are unavailable until your email is verified. Verification is
              required for security.
            </p>
          </>
        ),
      },
      {
        title: "Log in",
        content: (
          <>
            <ol>
              <li>Go to <strong>/login</strong>.</li>
              <li>Enter your email and password.</li>
              <li>If you have enabled MFA, enter the 6-digit code from your authenticator app or a 9-digit backup code.</li>
              <li>Click <strong>Log in</strong>.</li>
            </ol>
            <p>
              Forgot your password? Use the <strong>Forgot password?</strong> link to receive a reset email.
            </p>
          </>
        ),
      },
      {
        title: "Your first dashboard view",
        screenshot: "dashboard.png",
        screenshotCaption: "The Evernaro dashboard shows a quick overview of conversations, contacts, campaigns, reminders, and channel health.",
        content: (
          <>
            <p>Once you log in, the dashboard gives you a quick snapshot of your business:</p>
            <ul>
              <li>
                <strong>Conversations today:</strong> How many customer conversations have started.
              </li>
              <li>
                <strong>Open conversations:</strong> Conversations that need a reply.
              </li>
              <li>
                <strong>Contacts:</strong> Total customers in your database.
              </li>
              <li>
                <strong>Active campaigns:</strong> Campaigns currently sending or scheduled.
              </li>
              <li>
                <strong>Reminders today:</strong> Reminders scheduled for today.
              </li>
              <li>
                <strong>Channel health:</strong> Status of WhatsApp, Telegram, Email, Instagram, and Voice.
              </li>
            </ul>
            <p>
              The left sidebar is your main navigation. It adapts to your industry template, so some items may appear
              only when relevant (for example, Memberships or Job Cards).
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "business-setup",
    title: "Business & Salon Setup",
    description: "Configure your business profile, locations, team roles, and settings so Evernaro matches your operations.",
    icon: Building2,
    readingTime: "5 min",
    keywords: ["business", "profile", "settings", "team", "roles", "locations", "hours"],
    related: ["getting-started", "services-appointments", "channels"],
    sections: [
      {
        title: "Business profile",
        screenshot: "settings.png",
        screenshotCaption: "Settings page where you can update business name, address, contact details, and tone.",
        content: (
          <>
            <p>
              Your business profile is used in AI drafts, customer-facing messages, and the public booking page.
              Update it from <strong>Settings</strong> in the dashboard sidebar.
            </p>
            <p>Important fields:</p>
            <ul>
              <li>
                <strong>Business name:</strong> Shown to customers and used in AI-generated replies.
              </li>
              <li>
                <strong>Industry:</strong> Decides which dashboard modules and terminology are available.
              </li>
              <li>
                <strong>Description:</strong> Helps the AI understand what your business does.
              </li>
              <li>
                <strong>Address / phone / website:</strong> Used in customer-facing pages and messages.
              </li>
              <li>
                <strong>Tone:</strong> Friendly, professional, or formal — guides AI drafts and reminders.
              </li>
              <li>
                <strong>Working hours / timezone:</strong> Used for appointment slots and reminder timing.
              </li>
              <li>
                <strong>Knowledge base:</strong> Add policies, pricing, FAQs, and services so the AI can draft accurate replies.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Locations",
        content: (
          <>
            <p>
              If you run multiple branches or service points, add them under <strong>Locations</strong>. Each location
              can have its own staff, queue, and appointment calendar.
            </p>
            <ol>
              <li>Go to <strong>Locations</strong> in the sidebar.</li>
              <li>Click <strong>Add location</strong>.</li>
              <li>Enter the location name, address, and phone.</li>
              <li>Switch between locations from the dropdown at the top of the sidebar.</li>
            </ol>
          </>
        ),
      },
      {
        title: "Team and roles",
        screenshot: "team.png",
        screenshotCaption: "Team page lets you invite staff and assign roles with different permissions.",
        content: (
          <>
            <p>
              Invite your team from <strong>Team</strong> in the sidebar. Evernaro has four roles:
            </p>
            <ul>
              <li>
                <strong>Owner:</strong> Full access, including billing and team management.
              </li>
              <li>
                <strong>Admin:</strong> Can manage most settings, services, customers, and campaigns.
              </li>
              <li>
                <strong>Agent:</strong> Can reply in the inbox, manage customers, and handle appointments.
              </li>
              <li>
                <strong>Viewer:</strong> Read-only access to dashboards and reports.
              </li>
            </ul>
            <p>
              Each invited user receives an email with a temporary password. They must change it after their first login.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "services-appointments",
    title: "Services, Customers & Appointments",
    description: "Set up the services you offer, add customers, and manage their appointments end to end.",
    icon: CalendarDays,
    readingTime: "6 min",
    keywords: ["services", "customers", "contacts", "appointments", "bookings", "calendar"],
    related: ["business-setup", "automations", "booking"],
    sections: [
      {
        title: "Create services",
        screenshot: "services.png",
        screenshotCaption: "Services page lists every service with duration, price, and assigned staff.",
        content: (
          <>
            <p>
              Services are the building blocks of appointments and public booking. Go to <strong>Services</strong> in the
              sidebar and click <strong>Add service</strong>.
            </p>
            <p>Fields you can configure:</p>
            <ul>
              <li>
                <strong>Name:</strong> For example, Haircut, Facial, or Bridal Makeup.
              </li>
              <li>
                <strong>Duration:</strong> How long the service takes in minutes. This drives appointment slots.
              </li>
              <li>
                <strong>Price:</strong> Optional price in INR. Shown on the public booking page.
              </li>
              <li>
                <strong>Color:</strong> A visual color for the service in calendars and reports.
              </li>
              <li>
                <strong>Staff:</strong> Assign staff members who can perform this service.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Add customers",
        screenshot: "contacts.png",
        screenshotCaption: "Customers page shows your contact list with names, phone numbers, tags, and recent activity.",
        content: (
          <>
            <p>
              Customers are also called <strong>contacts</strong> in Evernaro. Add them manually under{" "}
              <strong>Customers</strong> or import them from a CSV file.
            </p>
            <p>For each customer you can store:</p>
            <ul>
              <li>Name, phone, and email.</li>
              <li>Tags such as VIP or Repeat.</li>
              <li>Notes about preferences or history.</li>
              <li>Appointments, invoices, queue entries, and conversation history.</li>
            </ul>
            <p>
              When a customer messages you through a connected channel, Evernaro automatically links the message to their
              contact record if the phone or email matches.
            </p>
          </>
        ),
      },
      {
        title: "Create appointments",
        screenshot: "appointments.png",
        screenshotCaption: "Appointments page shows upcoming and past appointments with status and customer details.",
        content: (
          <>
            <p>
              Appointments connect a customer, a service, a staff member, and a time slot. Go to{" "}
              <strong>Appointments</strong> and click <strong>New appointment</strong>.
            </p>
            <ol>
              <li>Select the customer.</li>
              <li>Select the service.</li>
              <li>Select the staff member (optional).</li>
              <li>Pick the date and time.</li>
              <li>Add notes if needed.</li>
              <li>Save the appointment.</li>
            </ol>
            <p>Appointment statuses:</p>
            <ul>
              <li>
                <strong>Booked:</strong> Reserved but not yet confirmed.
              </li>
              <li>
                <strong>Confirmed:</strong> Ready to happen.
              </li>
              <li>
                <strong>Completed:</strong> Finished.
              </li>
              <li>
                <strong>Cancelled:</strong> No longer happening.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "How services, customers, and appointments connect",
        content: (
          <>
            <p>
              <strong>Customer → Service → Appointment</strong> is the core workflow in Evernaro:
            </p>
            <ol>
              <li>A customer books or is booked for a service.</li>
              <li>Evernaro creates an appointment with the right duration and staff.</li>
              <li>Automated reminders are generated based on the appointment time.</li>
              <li>After the appointment, follow-up messages or review requests can be sent automatically.</li>
            </ol>
          </>
        ),
      },
    ],
  },
  {
    id: "channels",
    title: "Communication Channels",
    description: "Connect WhatsApp, Telegram, Email, Instagram, and Voice so customers can reach you on their favorite channel.",
    icon: MessageCircle,
    readingTime: "8 min",
    keywords: ["whatsapp", "telegram", "email", "instagram", "voice", "gupshup", "twilio", "resend", "channels"],
    related: ["inbox", "automations", "troubleshooting"],
    sections: [
      {
        title: "Channel overview",
        screenshot: "channels.png",
        screenshotCaption: "Channels page shows which communication channels are connected and which still need setup.",
        content: (
          <>
            <p>
              Evernaro can send and receive messages through five channels. You do not need to connect all of them.
              Start with the ones your customers already use.
            </p>
            <p>Supported channels:</p>
            <ul>
              <li>WhatsApp (via Gupshup)</li>
              <li>Telegram</li>
              <li>Email (via Resend)</li>
              <li>Instagram</li>
              <li>Voice reminders (via Twilio)</li>
            </ul>
            <p>
              <strong>Important:</strong> Each channel requires credentials from a separate provider. Evernaro never
              shares your provider credentials and stores them encrypted in your database.
            </p>
          </>
        ),
      },
      {
        title: "WhatsApp via Gupshup",
        content: (
          <>
            <p>
              WhatsApp messages are sent through the <strong>Gupshup WhatsApp Business API</strong>. You need a
              Gupshup account with an approved WhatsApp Business app and templates.
            </p>
            <p>What you need from Gupshup:</p>
            <ul>
              <li>
                <strong>API key:</strong> Found in your Gupshup dashboard.
              </li>
              <li>
                <strong>App name:</strong> The name of your WhatsApp app in Gupshup.
              </li>
              <li>
                <strong>App ID:</strong> A GUID for your Gupshup app.
              </li>
              <li>
                <strong>Source number:</strong> Your registered WhatsApp business number without the leading +.
              </li>
            </ul>
            <p>Steps:</p>
            <ol>
              <li>Go to <strong>Channels</strong> and click <strong>Connect</strong> on WhatsApp.</li>
              <li>Enter the API key, app name, app ID, and source number.</li>
              <li>Evernaro validates the credentials and saves them encrypted.</li>
              <li>Copy the webhook URL shown after connection and paste it into your Gupshup dashboard.</li>
              <li>Create message templates in Gupshup for campaigns and reminders, then sync them in Evernaro.</li>
            </ol>
            <p>
              <strong>Note:</strong> You cannot send free-text WhatsApp messages to customers outside the 24-hour
              service window unless you use an approved template. Evernaro enforces this automatically.
            </p>
          </>
        ),
      },
      {
        title: "Telegram",
        content: (
          <>
            <p>
              Telegram uses a bot that you create with <strong>BotFather</strong>.
            </p>
            <ol>
              <li>Open Telegram and message <strong>@BotFather</strong>.</li>
              <li>Use <strong>/newbot</strong> and follow the prompts to create a bot.</li>
              <li>Copy the bot token that BotFather gives you.</li>
              <li>In Evernaro, go to <strong>Channels → Telegram → Connect</strong> and paste the token.</li>
              <li>Set the webhook URL in your bot settings so Telegram can deliver incoming messages to Evernaro.</li>
            </ol>
            <p>
              <strong>Tip:</strong> Customers can start a conversation by messaging your bot username.
            </p>
          </>
        ),
      },
      {
        title: "Email via Resend",
        content: (
          <>
            <p>
              Outbound emails are sent through <strong>Resend</strong>. You need a Resend account and a verified
              sender domain.
            </p>
            <ol>
              <li>Sign up at Resend and verify your domain (for example, evernaro.com or your own domain).</li>
              <li>Generate an API key.</li>
              <li>In Evernaro, go to <strong>Channels → Email → Connect</strong>.</li>
              <li>Enter the sender address and Resend API key.</li>
              <li>Save the channel.</li>
            </ol>
            <p>
              <strong>Note:</strong> Email deliverability depends on your domain reputation. Resend handles sending,
              bounces, and reputation monitoring.
            </p>
          </>
        ),
      },
      {
        title: "Instagram",
        content: (
          <>
            <p>
              Instagram requires a <strong>Meta Business account</strong>, a Facebook Page connected to your Instagram
              Professional account, and a Meta App with the Instagram messaging permissions.
            </p>
            <p>What you need:</p>
            <ul>
              <li>Meta App ID and App Secret.</li>
              <li>Page Access Token for the connected Facebook Page.</li>
              <li>Instagram Professional account linked to that page.</li>
              <li>Webhook subscription configured in Meta to point to Evernaro.</li>
            </ul>
            <p>
              <strong>Note:</strong> Instagram setup is the most involved channel. You may need platform-admin
              assistance to complete Meta verification and webhook configuration.
            </p>
          </>
        ),
      },
      {
        title: "Voice reminders via Twilio",
        content: (
          <>
            <p>
              Voice is used only for scheduled reminder calls, not for two-way messaging. You need a{" "}
              <strong>Twilio</strong> account with a voice-capable phone number.
            </p>
            <p>What you need:</p>
            <ul>
              <li>Twilio Account SID.</li>
              <li>Twilio Auth Token.</li>
              <li>Twilio phone number with voice capability.</li>
            </ul>
            <p>
              <strong>Tip:</strong> Voice reminders are triggered from the <strong>Reminders</strong> page. Use them
              sparingly for important appointments or payment follow-ups.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "inbox",
    title: "Inbox & Customer Conversations",
    description: "Manage all customer messages in one unified inbox, reply across channels, and keep conversation history.",
    icon: Inbox,
    readingTime: "5 min",
    keywords: ["inbox", "conversations", "messages", "reply", "threads", "unified"],
    related: ["channels", "ai", "services-appointments"],
    sections: [
      {
        title: "Unified inbox",
        screenshot: "inbox.png",
        screenshotCaption: "The inbox shows every customer conversation across connected channels with filters and status.",
        content: (
          <>
            <p>
              The <strong>Inbox</strong> brings every customer message into one place, no matter which channel it came
              from. You can see WhatsApp, Telegram, Email, and Instagram messages side by side.
            </p>
            <p>Inbox features:</p>
            <ul>
              <li>
                <strong>Search:</strong> Find customers by name, phone, or email.
              </li>
              <li>
                <strong>Filters:</strong> Filter by channel, status (Open, Resolved, Closed), priority, or assignment.
              </li>
              <li>
                <strong>Status:</strong> Mark conversations as Open, Resolved, or Closed to keep your team organized.
              </li>
              <li>
                <strong>Assignment:</strong> Assign conversations to specific team members.
              </li>
              <li>
                <strong>Customer details:</strong> See the customer profile and history next to the conversation.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Reply to a customer",
        content: (
          <>
            <ol>
              <li>Open the <strong>Inbox</strong>.</li>
              <li>Click a conversation from the list.</li>
              <li>Type your reply in the message box.</li>
              <li>Click <strong>Send</strong>. The message goes out on the same channel the customer used.</li>
            </ol>
            <p>
              <strong>Note:</strong> WhatsApp messages outside the 24-hour service window require an approved template.
              Evernaro will warn you if a template is needed.
            </p>
          </>
        ),
      },
      {
        title: "Conversation workflow",
        content: (
          <>
            <p>A typical conversation flow looks like this:</p>
            <ol>
              <li>
                <strong>Customer → Channel:</strong> A customer sends a message on WhatsApp, Telegram, Email, or Instagram.
              </li>
              <li>
                <strong>Channel → Evernaro Inbox:</strong> The message appears in your unified inbox.
              </li>
              <li>
                <strong>AI draft (optional):</strong> Evernaro generates a suggested reply based on your knowledge base.
              </li>
              <li>
                <strong>Staff review:</strong> Your team edits or rejects the draft, then sends the reply.
              </li>
              <li>
                <strong>History:</strong> The full conversation is saved with the customer record.
              </li>
            </ol>
          </>
        ),
      },
    ],
  },
  {
    id: "ai",
    title: "AI Assistant",
    description: "Use AI-drafted replies to respond faster. Your team reviews, edits, and approves every message.",
    icon: Bot,
    readingTime: "4 min",
    keywords: ["ai", "assistant", "draft", "reply", "openai", "knowledge base"],
    related: ["inbox", "business-setup", "troubleshooting"],
    sections: [
      {
        title: "What the AI does",
        content: (
          <>
            <p>
              Evernaro uses AI to <strong>draft replies</strong> for incoming customer messages. The AI reads your
              business profile, knowledge base, and the conversation history, then suggests a response.
            </p>
            <p>
              <strong>Important:</strong> The AI only drafts. A human team member must review, edit, and send every reply.
              Nothing is sent automatically.
            </p>
          </>
        ),
      },
      {
        title: "How AI drafts appear",
        content: (
          <>
            <p>When a new customer message arrives:</p>
            <ol>
              <li>Evernaro processes the message in the background.</li>
              <li>A draft reply appears in the conversation thread, marked as <strong>AI draft</strong>.</li>
              <li>You can edit the draft, send it as-is, or discard it and type your own reply.</li>
            </ol>
            <p>
              <strong>Tip:</strong> The better your knowledge base and business profile, the more accurate the drafts.
              Add common FAQs, pricing, and policies to Settings.
            </p>
          </>
        ),
      },
      {
        title: "AI configuration",
        content: (
          <>
            <p>
              AI is powered by <strong>OpenAI</strong>. The platform admin configures the API key. It is stored securely
              on the server and never exposed to the browser.
            </p>
            <p>
              <strong>Privacy:</strong> Customer messages are sent to OpenAI for generating drafts. Do not include
              sensitive personal or financial information in your knowledge base if you want to avoid exposing it to
              the AI provider.
            </p>
          </>
        ),
      },
      {
        title: "When AI drafts do not appear",
        content: (
          <>
            <p>If you do not see AI drafts:</p>
            <ul>
              <li>The AI provider key may not be configured yet.</li>
              <li>Your plan may not include the AI assistant feature.</li>
              <li>The conversation may have moved on before the draft finished.</li>
              <li>There may not be enough context (business profile or knowledge base) to draft a reply.</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    id: "automations",
    title: "Automated Reminders & Campaigns",
    description: "Schedule appointment reminders, run campaigns, and automate follow-ups with your customers.",
    icon: Bell,
    readingTime: "6 min",
    keywords: ["reminders", "campaigns", "automations", "follow-up", "scheduled", "broadcast"],
    related: ["services-appointments", "channels", "booking"],
    sections: [
      {
        title: "Appointment reminders",
        screenshot: "reminders.png",
        screenshotCaption: "Reminders page shows upcoming and past reminders sent to customers.",
        content: (
          <>
            <p>
              Reminders are automatically generated when an appointment is created. You can also create them manually
              from the <strong>Reminders</strong> page.
            </p>
            <p>How reminders work:</p>
            <ol>
              <li>An appointment is booked or confirmed.</li>
              <li>Evernaro schedules a reminder before the appointment time.</li>
              <li>A background worker sends the reminder through the connected channel (WhatsApp, Email, etc.).</li>
              <li>The reminder status is updated to Sent or Failed.</li>
            </ol>
            <p>
              <strong>Note:</strong> WhatsApp reminders must use approved templates. Free-text reminders only work if
              the customer has messaged you within the last 24 hours.
            </p>
          </>
        ),
      },
      {
        title: "Campaigns",
        screenshot: "campaigns.png",
        screenshotCaption: "Campaigns page lets you create broadcast messages to groups of customers.",
        content: (
          <>
            <p>
              Campaigns let you send a broadcast message to many customers at once. Use them for promotions, event
              announcements, or seasonal offers.
            </p>
            <ol>
              <li>Go to <strong>Campaigns</strong> and click <strong>New campaign</strong>.</li>
              <li>Choose the channel (WhatsApp, Email, Telegram, etc.).</li>
              <li>Write the message. Use <code>{"{{name}}"}</code> to personalize with the customer name.</li>
              <li>Select the recipients from your contact list.</li>
              <li>Schedule or send immediately.</li>
            </ol>
            <p>
              <strong>Note:</strong> WhatsApp campaigns require approved templates. Evernaro will guide you to select one.
            </p>
          </>
        ),
      },
      {
        title: "Automations",
        content: (
          <>
            <p>
              Automations are rules that trigger actions based on customer events. For example:
            </p>
            <ul>
              <li>
                <strong>Appointment due soon:</strong> Send a reminder message.
              </li>
              <li>
                <strong>Service completed:</strong> Request a review after a few hours.
              </li>
            </ul>
            <p>
              Automations are configured by the platform admin or in your business settings. They run in the
              background so your team does not have to remember every follow-up.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "booking",
    title: "Public Booking & Customer Experience",
    description: "Give customers a branded booking page where they can book appointments and join queues without calling.",
    icon: Globe,
    readingTime: "4 min",
    keywords: ["booking", "public", "queue", "customer", "link", "qr", "appointment"],
    related: ["services-appointments", "automations", "channels"],
    sections: [
      {
        title: "Your public booking page",
        screenshot: "public-booking.png",
        screenshotCaption: "Public booking page lets customers select a service, date, and time without logging in.",
        content: (
          <>
            <p>
              Every organization gets a public booking page at{" "}
              <code>/business/your-business-slug/book</code>. Customers can:
            </p>
            <ul>
              <li>See your services and prices.</li>
              <li>Pick a date and time slot.</li>
              <li>Enter their name, phone, and email.</li>
              <li>Book an appointment instantly.</li>
            </ul>
            <p>
              <strong>To find your link:</strong> Go to <strong>Settings</strong> and look for your public booking URL,
              or share the page directly from your browser address bar.
            </p>
          </>
        ),
      },
      {
        title: "Public queues",
        content: (
          <>
            <p>
              For businesses that use queues, customers can join remotely and track their position. The queue page is
              at <code>/business/your-business-slug/queue</code>.
            </p>
            <p>Customer queue experience:</p>
            <ol>
              <li>Customer scans your QR code or opens the queue link.</li>
              <li>They enter their details and join the queue.</li>
              <li>They receive a token and see their live position.</li>
              <li>Evernaro notifies them when their turn is near.</li>
            </ol>
          </>
        ),
      },
      {
        title: "Sharing your page",
        content: (
          <>
            <p>Share your public pages with customers:</p>
            <ul>
              <li>Copy the booking or queue link from Settings.</li>
              <li>Add the link to your website, Instagram bio, or Google Business profile.</li>
              <li>Print the QR code from <strong>Queue → QR Codes</strong> and place it at your front desk.</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    id: "billing",
    title: "Billing, Subscription & Account Management",
    description: "Understand your Evernaro plan, manage payments through Razorpay, and keep your subscription active.",
    icon: CreditCard,
    readingTime: "5 min",
    keywords: ["billing", "subscription", "razorpay", "invoice", "plan", "payment", "wallet"],
    related: ["getting-started", "troubleshooting"],
    sections: [
      {
        title: "Plans and subscription",
        screenshot: "billing.png",
        screenshotCaption: "Billing page shows your current plan, subscription status, invoices, and WhatsApp wallet balance.",
        content: (
          <>
            <p>
              Evernaro offers subscription plans based on your business size. Your plan determines which features are
              available, how many team seats you can use, and how many campaign recipients you can reach per day.
            </p>
            <p>To manage your subscription:</p>
            <ol>
              <li>Go to <strong>Billing</strong> in the sidebar.</li>
              <li>Review your current plan and usage.</li>
              <li>Choose a new plan if needed and start the checkout.</li>
              <li>Complete payment through Razorpay.</li>
            </ol>
            <p>
              <strong>Tip:</strong> Plans start with a 14-day free trial. No credit card is required to start.
            </p>
          </>
        ),
      },
      {
        title: "Razorpay payments",
        content: (
          <>
            <p>
              Evernaro uses <strong>Razorpay</strong> for payments. You can pay with UPI, cards, net banking, or wallets.
            </p>
            <p>Payment flow:</p>
            <ol>
              <li>You create or receive an invoice in Evernaro.</li>
              <li>Click <strong>Pay now</strong> to open Razorpay Checkout.</li>
              <li>Complete the payment in your browser.</li>
              <li>Evernaro updates the invoice status and activates your subscription automatically.</li>
            </ol>
            <p>
              <strong>Test vs. live:</strong> Razorpay can run in test mode for verification. Make sure you switch to live
              mode before accepting real customer payments.
            </p>
          </>
        ),
      },
      {
        title: "WhatsApp wallet",
        content: (
          <>
            <p>
              WhatsApp messages are paid for using a prepaid wallet. Each message debits a small amount based on the
              message category (Marketing, Utility, or Service) and the destination country.
            </p>
            <p>To top up:</p>
            <ol>
              <li>Go to <strong>Billing → Wallet</strong>.</li>
              <li>Choose an amount.</li>
              <li>Pay through Razorpay.</li>
              <li>The balance is added to your wallet.</li>
            </ol>
            <p>
              <strong>Low balance:</strong> Evernaro sends an email alert when your wallet drops below the alert
              threshold.
            </p>
          </>
        ),
      },
      {
        title: "Invoices",
        content: (
          <>
            <p>
              Invoices are generated for subscription charges and wallet top-ups. You can view, download, and pay them
              from the <strong>Billing</strong> page.
            </p>
            <p>Invoice statuses:</p>
            <ul>
              <li>
                <strong>Pending:</strong> Payment is due.
              </li>
              <li>
                <strong>Paid:</strong> Payment completed successfully.
              </li>
              <li>
                <strong>Failed:</strong> Payment failed. Update your payment method and try again.
              </li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting, Security & Support",
    description: "Fix common issues, keep your account secure, and know when to contact support.",
    icon: Wrench,
    readingTime: "7 min",
    keywords: ["troubleshooting", "support", "security", "login", "email", "whatsapp", "payment", "error"],
    related: ["channels", "billing", "ai"],
    sections: [
      {
        title: "Cannot log in",
        content: (
          <>
            <p>
              <strong>Problem:</strong> Login fails or you see “Invalid email or password.”
            </p>
            <p>
              <strong>What to check:</strong>
            </p>
            <ul>
              <li>Make sure Caps Lock is off.</li>
              <li>Use the exact email address you registered with.</li>
              <li>Try resetting your password from the Forgot password link.</li>
              <li>If you recently changed your password, the old password no longer works.</li>
            </ul>
            <p>
              <strong>Next step:</strong> If you still cannot log in, contact support from your registered email address.
            </p>
          </>
        ),
      },
      {
        title: "Email verification not received",
        content: (
          <>
            <p>
              <strong>Problem:</strong> You did not receive the verification email.
            </p>
            <p>
              <strong>What to check:</strong>
            </p>
            <ul>
              <li>Check spam, promotions, and junk folders.</li>
              <li>Make sure you typed your email correctly when signing up.</li>
              <li>Wait a few minutes before trying again.</li>
            </ul>
            <p>
              <strong>Next step:</strong> Log in and click <strong>Resend verification email</strong> from the dashboard
              banner.
            </p>
          </>
        ),
      },
      {
        title: "WhatsApp is not sending",
        content: (
          <>
            <p>
              <strong>Problem:</strong> WhatsApp messages or reminders are not delivered.
            </p>
            <p>
              <strong>What to check:</strong>
            </p>
            <ul>
              <li>Verify your Gupshup API key, app name, app ID, and source number are correct in Channels.</li>
              <li>Make sure your WhatsApp Business number is approved by Meta.</li>
              <li>For campaigns and reminders, use an approved template.</li>
              <li>Check your WhatsApp wallet balance in Billing.</li>
              <li>Confirm the webhook URL is set correctly in Gupshup.</li>
            </ul>
            <p>
              <strong>Next step:</strong> If credentials are correct but messages still fail, contact support with the
              channel ID and a recent message timestamp.
            </p>
          </>
        ),
      },
      {
        title: "Customer reply is not appearing in the inbox",
        content: (
          <>
            <p>
              <strong>Problem:</strong> A customer replied but you do not see it in Evernaro.
            </p>
            <p>
              <strong>What to check:</strong>
            </p>
            <ul>
              <li>Verify the channel webhook URL is configured with the provider.</li>
              <li>Check that the channel is marked as active.</li>
              <li>Make sure the customer is using the same phone number or email stored in your contacts.</li>
              <li>Check if the conversation was filtered out by status or channel filters.</li>
            </ul>
            <p>
              <strong>Next step:</strong> Open the conversation directly by searching the customer name or phone.
            </p>
          </>
        ),
      },
      {
        title: "AI draft is not appearing",
        content: (
          <>
            <p>
              <strong>Problem:</strong> You expect an AI draft but none is shown.
            </p>
            <p>
              <strong>What to check:</strong>
            </p>
            <ul>
              <li>AI must be enabled for your plan.</li>
              <li>The AI provider key must be configured by the platform admin.</li>
              <li>Your business profile and knowledge base should have enough context.</li>
              <li>The AI draft may take a few seconds to generate. Refresh the conversation if needed.</li>
            </ul>
          </>
        ),
      },
      {
        title: "Payment failed",
        content: (
          <>
            <p>
              <strong>Problem:</strong> Your Razorpay payment did not complete.
            </p>
            <p>
              <strong>What to check:</strong>
            </p>
            <ul>
              <li>Make sure your card, UPI, or wallet has sufficient funds.</li>
              <li>Check for any bank SMS or app notification about the transaction.</li>
              <li>Verify you are using the live Razorpay keys, not test keys.</li>
            </ul>
            <p>
              <strong>Next step:</strong> Retry the payment from <strong>Billing</strong>. If the amount was debited but
              not reflected in Evernaro, contact support with the Razorpay payment ID.
            </p>
          </>
        ),
      },
      {
        title: "Booking page is not working",
        content: (
          <>
            <p>
              <strong>Problem:</strong> Customers cannot see or use your public booking page.
            </p>
            <p>
              <strong>What to check:</strong>
            </p>
            <ul>
              <li>Make sure your organization slug is correct in the URL.</li>
              <li>Verify your subscription is active.</li>
              <li>Check that you have at least one active service.</li>
              <li>Make sure your business hours and timezone are set so time slots can be generated.</li>
            </ul>
          </>
        ),
      },
      {
        title: "Security best practices",
        content: (
          <>
            <p>Keep your Evernaro account and customer data safe:</p>
            <ul>
              <li>Never share your password or MFA backup codes.</li>
              <li>Never share provider API keys, webhooks secrets, or tokens in support tickets.</li>
              <li>Use strong, unique passwords for each team member.</li>
              <li>Give team members the minimum role they need (Viewer, Agent, Admin, Owner).</li>
              <li>Remove former employees from your team immediately.</li>
              <li>Enable MFA for your owner account if available.</li>
              <li>Keep your <code>.env</code> and production secrets private. Never commit them to Git.</li>
            </ul>
          </>
        ),
      },
      {
        title: "Contact support",
        content: (
          <>
            <p>
              If you cannot resolve an issue, email <strong>support@evernaro.com</strong> from your registered email
              address. Include:
            </p>
            <ul>
              <li>Your business name or organization slug.</li>
              <li>A clear description of the problem.</li>
              <li>Steps you already tried.</li>
              <li>Any error messages or screenshots (without API keys or passwords).</li>
            </ul>
            <p>
              <strong>For urgent issues:</strong> Add “Urgent” to the subject line and we will prioritize your request.
            </p>
          </>
        ),
      },
    ],
  },
];

export function getCategoryById(id: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.id === id);
}

export function getCategoryIndex(id: string): number {
  return HELP_CATEGORIES.findIndex((c) => c.id === id);
}

export function getAllCategoryIds(): string[] {
  return HELP_CATEGORIES.map((c) => c.id);
}
