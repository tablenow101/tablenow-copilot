import http from "node:http";
import { pathToFileURL } from "node:url";

const port = Number(process.env.SIMULATOR_PORT || 4200);

export function createSimulatorServer() {
  return http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/healthz") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (!["/", "/reservations"].includes(url.pathname)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });
  response.end(page);
  });
}

const page = String.raw`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Interface universelle - Réservations</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #171915; background: #f4f5f0; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    header { min-height: 64px; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #171915; color: white; }
    header strong { font-size: 18px; }
    header span { color: #b8bfaf; font-size: 13px; }
    main { width: min(1040px, 100%); margin: 0 auto; padding: 28px 24px 60px; }
    .toolbar { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    p { margin: 0; color: #62685c; }
    button { min-height: 44px; border: 1px solid #242820; border-radius: 6px; padding: 0 16px; background: white; color: #171915; font: inherit; font-weight: 700; cursor: pointer; }
    button.primary { background: #bdf34c; }
    button:focus-visible, input:focus-visible { outline: 3px solid #4673ff; outline-offset: 2px; }
    .table { overflow: hidden; border: 1px solid #d9ddd3; border-radius: 8px; background: white; }
    .row { min-height: 64px; padding: 12px 16px; display: grid; grid-template-columns: minmax(160px, 1fr) 100px 90px 110px 120px; align-items: center; gap: 12px; border-bottom: 1px solid #e9ece5; }
    .row:last-child { border-bottom: 0; }
    .head { min-height: 42px; color: #687061; background: #f8f9f6; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .status { width: fit-content; border-radius: 999px; padding: 5px 9px; background: #eaf8cf; color: #345300; font-size: 12px; font-weight: 700; }
    .status.cancelled { background: #f0f0ed; color: #6d716a; }
    dialog { width: min(520px, calc(100% - 32px)); border: 0; border-radius: 8px; padding: 0; box-shadow: 0 24px 80px #0005; }
    dialog::backdrop { background: #1118; }
    form { padding: 24px; }
    form h2 { margin: 0 0 20px; }
    label { display: grid; gap: 6px; margin: 14px 0; font-size: 13px; font-weight: 700; }
    input { width: 100%; min-height: 44px; border: 1px solid #bfc5b8; border-radius: 6px; padding: 9px 11px; font: inherit; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
    .empty { padding: 30px; text-align: center; color: #687061; }
    #notice { min-height: 24px; margin: 12px 0; color: #345300; font-weight: 700; }
    @media (max-width: 700px) {
      header { padding: 12px 16px; }
      header span { display: none; }
      main { padding: 20px 14px 40px; }
      .toolbar { align-items: stretch; flex-direction: column; }
      .toolbar button { width: 100%; }
      .table { border: 0; background: transparent; overflow: visible; }
      .head { display: none; }
      .row { grid-template-columns: 1fr auto; gap: 8px; margin-bottom: 10px; border: 1px solid #d9ddd3; border-radius: 8px; background: white; }
      .row > :nth-child(2), .row > :nth-child(3) { color: #62685c; }
      .row > :nth-child(4) { grid-column: 1; }
      .row > :nth-child(5) { grid-column: 2; grid-row: 1 / span 2; }
      .row button { min-height: 40px; padding: 0 12px; }
    }
  </style>
</head>
<body>
  <header><strong>Interface universelle</strong><span>Environnement de validation local TableNow</span></header>
  <main>
    <section class="toolbar">
      <div><h1>Réservations</h1><p>Service du soir · données fictives</p></div>
      <button class="primary" id="new-reservation" type="button">Nouvelle réservation</button>
    </section>
    <div id="notice" role="status" aria-live="polite"></div>
    <section class="table" aria-label="Liste des réservations" data-testid="reservation-list">
      <div class="row head"><span>Client</span><span>Heure</span><span>Couverts</span><span>Statut</span><span>Action</span></div>
      <div id="reservation-rows"></div>
    </section>
  </main>
  <dialog id="reservation-dialog">
    <form id="reservation-form" method="dialog">
      <h2>Nouvelle réservation</h2>
      <label>Nom du client<input name="guestName" autocomplete="off" required></label>
      <label>Téléphone<input name="guestPhone" autocomplete="off" inputmode="tel"></label>
      <label>Couverts<input name="partySize" type="number" min="1" max="30" required></label>
      <label>Heure<input name="time" type="time" required></label>
      <div class="actions">
        <button id="close-dialog" type="button">Fermer</button>
        <button class="primary" type="submit">Enregistrer la réservation</button>
      </div>
    </form>
  </dialog>
  <script>
    const storageKey = 'tablenow-simulator-reservations-v1';
    const initial = [
      { id: 'demo-1', guestName: 'Nadia Martin', guestPhone: '06 00 00 00 01', partySize: 4, time: '19:30', status: 'confirmed' },
      { id: 'demo-2', guestName: 'Paul Bernard', guestPhone: '06 00 00 00 02', partySize: 2, time: '20:15', status: 'confirmed' }
    ];
    let reservations;
    try { reservations = JSON.parse(localStorage.getItem(storageKey)) || initial; } catch { reservations = initial; }
    const rows = document.querySelector('#reservation-rows');
    const dialog = document.querySelector('#reservation-dialog');
    const form = document.querySelector('#reservation-form');
    const notice = document.querySelector('#notice');
    function persist() { localStorage.setItem(storageKey, JSON.stringify(reservations)); }
    function render() {
      rows.replaceChildren();
      if (!reservations.length) {
        const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'Aucune réservation'; rows.append(empty); return;
      }
      for (const reservation of reservations) {
        const row = document.createElement('div'); row.className = 'row'; row.dataset.reservationId = reservation.id;
        const guest = document.createElement('strong'); guest.textContent = reservation.guestName;
        const time = document.createElement('span'); time.textContent = reservation.time;
        const party = document.createElement('span'); party.textContent = String(reservation.partySize);
        const status = document.createElement('span'); status.className = 'status' + (reservation.status === 'cancelled' ? ' cancelled' : ''); status.textContent = reservation.status === 'cancelled' ? 'Annulée' : 'Confirmée';
        const action = document.createElement('button'); action.type = 'button'; action.textContent = reservation.status === 'cancelled' ? 'Réactiver' : 'Annuler';
        action.addEventListener('click', () => { reservation.status = reservation.status === 'cancelled' ? 'confirmed' : 'cancelled'; persist(); render(); notice.textContent = 'Statut mis à jour.'; });
        row.append(guest, time, party, status, action); rows.append(row);
      }
    }
    document.querySelector('#new-reservation').addEventListener('click', () => dialog.showModal());
    document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      reservations.unshift({ id: crypto.randomUUID(), guestName: String(data.get('guestName')), guestPhone: String(data.get('guestPhone')), partySize: Number(data.get('partySize')), time: String(data.get('time')), status: 'confirmed' });
      persist(); render(); form.reset(); dialog.close(); notice.textContent = 'Réservation enregistrée.';
    });
    render();
  </script>
</body>
</html>`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createSimulatorServer().listen(port, "0.0.0.0", () => process.stdout.write(`[integration-simulator] listening on ${port}\n`));
}
