"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  LogOut,
  MessageSquareText,
  Menu,
  Network,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, Workspace } from "@/lib/types";
import { api } from "@/lib/api";

const nav = [
  { key: "today", href: "/today", label: "Aujourd'hui", icon: Activity },
  { key: "communications", href: "/communications", label: "Communications", icon: MessageSquareText },
  { key: "reservations", href: "/reservations", label: "Réservations", icon: CalendarDays },
  { key: "operations", href: "/operations", label: "Opérations", icon: ClipboardCheck },
  { key: "team", href: "/team", label: "Équipe", icon: Users },
  { key: "inventory", href: "/inventory", label: "Stocks", icon: Boxes },
  { key: "performance", href: "/performance", label: "Performance", icon: BarChart3 },
  { key: "locations", href: "/locations", label: "Établissements", icon: Building2 },
  { key: "systems", href: "/systems", label: "Systèmes & actions", icon: Network },
];
const emptyRestaurants: Workspace["restaurants"] = [];
const ignoreRestaurantChange = () => undefined;

export function AppChrome({
  session,
  active,
  title,
  subtitle,
  children,
  refreshing = false,
  onRefresh,
  notifications = [],
  restaurants = emptyRestaurants,
  activeRestaurantId = null,
  onRestaurantChange = ignoreRestaurantChange,
}: {
  session: Session;
  active: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  notifications?: Array<{ id: string; title: string; detail: string; href: string }>;
  restaurants?: Workspace["restaurants"];
  activeRestaurantId?: string | null;
  onRestaurantChange?: (restaurantId: string | null) => void;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState<"location" | "notifications" | "profile" | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSheetRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(null); setMoreOpen(false); } };
    const closePopover = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest(".topbar-menu-anchor")) setMenu(null);
    };
    window.addEventListener("keydown", close);
    document.addEventListener("pointerdown", closePopover);
    return () => {
      window.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", closePopover);
    };
  }, []);
  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sheet = mobileSheetRef.current;
    const focusableSelector = "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";
    window.requestAnimationFrame(() => sheet?.querySelector<HTMLElement>(focusableSelector)?.focus());
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !sheet) return;
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.body.style.overflow = previousOverflow;
      moreButtonRef.current?.focus();
    };
  }, [moreOpen]);
  const logout = async () => {
    await api("/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };
  const activeRestaurant = restaurants.find((restaurant) => restaurant.id === activeRestaurantId);
  const activeContextLabel = activeRestaurant?.name || (restaurants.length > 1 ? "Vue groupe" : restaurants[0]?.name || session.tenant.name);
  const changeRestaurant = (restaurantId: string | null) => {
    onRestaurantChange(restaurantId);
    setMenu(null);
  };

  return (
    <div className="product-root">
      <aside className="sidebar">
        <Link className="logo-lockup" href="/today" aria-label="TableNow — Aujourd'hui">
          <span className="brand-mark brand-mark-small">T<span>N</span></span>
          <span>TableNow<small>Operating Copilot</small></span>
        </Link>
        <nav className="main-nav" aria-label="Navigation produit">
          {nav.map((item) => {
            const Icon = item.icon;
            return <Link key={item.key} href={item.href} className={active === item.key ? "active" : ""} aria-current={active === item.key ? "page" : undefined}><Icon size={17} /><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-divider" />
        <Link href="/copilot" className={`copilot-nav ${active === "copilot" ? "active" : ""}`}><Sparkles size={17} /><span>TableNow Copilot</span><i>AI</i></Link>
        <div className="sidebar-spacer" />
        {session.membership.role === "platform_admin" && <Link href="/admin/pilots" className={active === "admin" ? "utility-active" : ""}><Settings2 size={16} /> Pilotes privés</Link>}
        <Link href="/privacy" className={active === "privacy" ? "utility-active" : ""}><ShieldCheck size={16} /> Confidentialité</Link>
        <button className="sidebar-logout" onClick={logout}><LogOut size={16} /> Déconnexion</button>
        <div className="node-state"><span /><div><strong>Architecture local-first</strong><small>État détaillé dans Systèmes</small></div></div>
      </aside>

      <div className="product-main">
        <header className="topbar">
          <div className="topbar-menu-anchor">
            <button className="location-switcher" onClick={() => setMenu(menu === "location" ? null : "location")} aria-expanded={menu === "location"} aria-controls="location-popover"><Building2 size={15} /><span>{activeContextLabel}</span><ChevronDown size={14} /></button>
            {menu === "location" && <div id="location-popover" className="topbar-popover location-popover" role="region" aria-label="Choisir le périmètre actif"><span>Périmètre actif</span><strong>{activeContextLabel}</strong><small>Ce choix filtre toutes les données et actions de la console.</small><div className="location-choice-list">{restaurants.length > 1 && <button className={!activeRestaurantId ? "active" : ""} aria-pressed={!activeRestaurantId} onClick={() => changeRestaurant(null)}><span className="location-choice-icon"><Building2 size={15} /></span><span><strong>Vue groupe</strong><small>{restaurants.length} établissements réunis</small></span>{!activeRestaurantId && <i><Check size={13} /></i>}</button>}{restaurants.map((restaurant) => <button key={restaurant.id} className={activeRestaurantId === restaurant.id ? "active" : ""} aria-pressed={activeRestaurantId === restaurant.id} onClick={() => changeRestaurant(restaurant.id)}><span className="location-choice-icon">{initials(restaurant.name)}</span><span><strong>{restaurant.name}</strong><small>{restaurant.address || "Adresse à compléter"}</small></span>{activeRestaurantId === restaurant.id && <i><Check size={13} /></i>}</button>)}</div><Link className="location-utility-link" href="/locations" onClick={() => setMenu(null)}><Building2 size={15} /> Voir les établissements</Link><Link className="location-utility-link" href="/systems" onClick={() => setMenu(null)}><Network size={15} /> Configurer les systèmes</Link></div>}
          </div>
          <div className="top-actions">
            {onRefresh && <button className="icon-button" onClick={onRefresh} aria-label="Actualiser" title="Actualiser"><RefreshCw size={16} className={refreshing ? "spinning" : ""} /></button>}
            <div className="topbar-menu-anchor">
              <button className="icon-button notification-button" onClick={() => setMenu(menu === "notifications" ? null : "notifications")} aria-label={`Notifications${notifications.length ? `, ${notifications.length} non lues` : ""}`} aria-expanded={menu === "notifications"} aria-controls="notifications-popover"><Bell size={16} />{notifications.length > 0 && <i />}</button>
              {menu === "notifications" && <div id="notifications-popover" className="topbar-popover notifications-popover" role="region" aria-label="Notifications"><header><strong>À traiter</strong><span>{notifications.length}</span></header>{notifications.length ? notifications.map((notification) => <Link href={notification.href} key={notification.id} onClick={() => setMenu(null)}><span><strong>{notification.title}</strong><small>{notification.detail}</small></span><ArrowRight size={14} /></Link>) : <p>Rien ne demande votre attention.</p>}<Link className="popover-footer" href="/today" onClick={() => setMenu(null)}>Ouvrir le cockpit <ArrowRight size={14} /></Link></div>}
            </div>
            <div className="topbar-menu-anchor">
              <button className="profile-chip" onClick={() => setMenu(menu === "profile" ? null : "profile")} aria-expanded={menu === "profile"} aria-controls="profile-popover"><span>{initials(session.user.displayName || session.user.email)}</span><div><strong>{session.user.displayName || "Direction"}</strong><small>{roleLabel(session.membership.role)}</small></div><ChevronDown size={13} /></button>
              {menu === "profile" && <div id="profile-popover" className="topbar-popover profile-popover" role="region" aria-label="Compte"><span>{session.user.email}</span><Link href="/privacy" onClick={() => setMenu(null)}><ShieldCheck size={15} /> Confidentialité</Link>{session.membership.role === "platform_admin" && <Link href="/admin/pilots" onClick={() => setMenu(null)}><Settings2 size={15} /> Pilotes privés</Link>}<button onClick={() => void logout()}><LogOut size={15} /> Déconnexion</button></div>}
            </div>
          </div>
        </header>
        <main className="workspace">
          <div className="page-heading"><div><span className="eyebrow"><Bot size={13} /> Pilotage en direct</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div>
          {children}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Navigation mobile">
        {nav.slice(0, 3).map((item) => { const Icon = item.icon; return <Link key={item.key} href={item.href} className={active === item.key ? "active" : ""} aria-current={active === item.key ? "page" : undefined}><Icon size={19} /><span>{item.label.split(" ")[0]}</span></Link>; })}
        <Link href="/copilot" className={active === "copilot" ? "active" : ""} aria-current={active === "copilot" ? "page" : undefined}><Sparkles size={19} /><span>Copilot</span></Link>
        <button ref={moreButtonRef} className={nav.slice(3).some((item) => item.key === active) ? "active" : ""} onClick={() => setMoreOpen(true)} aria-label="Ouvrir toute la navigation" aria-expanded={moreOpen} aria-controls="mobile-menu"><Menu size={19} /><span>Tout</span></button>
      </nav>
      {moreOpen && <><button className="mobile-sheet-backdrop" onClick={() => setMoreOpen(false)} aria-label="Fermer la navigation" /><section ref={mobileSheetRef} id="mobile-menu" className="mobile-sheet" aria-modal="true" role="dialog" aria-labelledby="mobile-menu-title"><header><div><span>Navigation</span><h2 id="mobile-menu-title">Tout TableNow</h2></div><button className="icon-button" onClick={() => setMoreOpen(false)} aria-label="Fermer"><X size={18} /></button></header><nav>{nav.map((item) => { const Icon = item.icon; return <Link key={item.key} href={item.href} className={active === item.key ? "active" : ""} aria-current={active === item.key ? "page" : undefined} onClick={() => setMoreOpen(false)}><Icon size={18} /><span>{item.label}</span><ChevronDown size={14} /></Link>; })}<Link href="/copilot" className={active === "copilot" ? "active" : ""} aria-current={active === "copilot" ? "page" : undefined} onClick={() => setMoreOpen(false)}><Sparkles size={18} /><span>TableNow Copilot</span><ChevronDown size={14} /></Link></nav><footer><Link href="/privacy" onClick={() => setMoreOpen(false)}><ShieldCheck size={17} /> Confidentialité</Link>{session.membership.role === "platform_admin" && <Link href="/admin/pilots" onClick={() => setMoreOpen(false)}><Settings2 size={17} /> Pilotes privés</Link>}<button onClick={() => void logout()}><LogOut size={17} /> Déconnexion</button></footer></section></>}
    </div>
  );
}

function initials(value: string): string {
  return value.split(/[\s@]+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function roleLabel(role: string): string {
  return ({ platform_admin: "Administration", owner: "Propriétaire", group_admin: "Direction groupe", manager: "Responsable", operator: "Opérations", viewer: "Lecture" } as Record<string, string>)[role] || role;
}
