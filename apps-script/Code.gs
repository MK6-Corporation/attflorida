/**
 * ATT Florida — reservation receiver (Google Apps Script)
 *
 * Each reservation:
 *  - creates a folder "<date> – <name>" inside the "ATT Florida – Reservations" Drive folder
 *  - saves every passport file into that folder
 *  - adds one row to the "Reservations" sheet (with a link to the folder)
 *  - emails NOTIFY_EMAIL a short summary
 *
 * Setup: see README.md next to this file.
 */
const ROOT_FOLDER_NAME = 'ATT Florida – Reservations';
const SHEET_NAME = 'Reservations';
const NOTIFY_EMAIL = ''; // e.g. 'reservations@yourdomain.com' — leave empty to skip emails
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const p = JSON.parse(e.postData.contents);
    if (!p.fullName || !p.email || !Array.isArray(p.travelerDetails)) throw new Error('Missing fields');

    const root = getOrCreateRootFolder_();
    const stamp = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd HH:mm');
    const folder = root.createFolder(stamp + ' – ' + clean_(p.fullName));

    const travelerLines = p.travelerDetails.map(function (t) {
      let fileUrl = '';
      if (t.passport && t.passport.data) {
        const bytes = Utilities.base64Decode(t.passport.data);
        if (bytes.length > MAX_FILE_BYTES) throw new Error('File too large');
        const ext = (t.passport.name.match(/\.[a-z0-9]+$/i) || [''])[0];
        const blob = Utilities.newBlob(bytes, t.passport.type, 'Passport ' + t.n + ' – ' + clean_(t.name) + ext);
        fileUrl = folder.createFile(blob).getUrl();
      }
      return t.n + '. ' + t.name + ' | DOB ' + t.dob + ' | ' + t.nationality +
        ' | expires ' + t.expiry + (t.expiresTooSoon ? ' (EXPIRES TOO SOON)' : '') +
        (fileUrl ? ' | ' + fileUrl : ' | no file');
    });

    const sheet = getSheet_();
    sheet.appendRow([
      new Date(), p.package, p.fullName, p.email, "'" + p.phone, p.residence, p.travelers,
      p.room, p.flights, p.payment, p.plan, p.planSummary, p.questions, p.notes, p.emergencyName, "'" + (p.emergencyPhone || ''),
      travelerLines.join('\n'), folder.getUrl(), 'New'
    ]);

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        replyTo: p.email,
        subject: (p.questions ? '[Question] ' : '') + 'New reservation: ' + p.fullName + ' (' + p.travelers + ' travelers) – ' + p.package,
        body: [
          'Name: ' + p.fullName, 'Email: ' + p.email, 'Phone: ' + p.phone, 'Residence: ' + p.residence,
          'Room: ' + p.room, 'Flights: ' + p.flights,
          'Payment: ' + p.payment, 'Plan: ' + p.planSummary, 'Questions: ' + p.questions, 'Notes: ' + p.notes,
          'Emergency contact: ' + p.emergencyName + ' ' + p.emergencyPhone, '', 'Travelers:', travelerLines.join('\n'), '',
          'Passports folder: ' + folder.getUrl()
        ].join('\n')
      });
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return json_({ ok: true, service: 'ATT Florida reservations' }); }

function getOrCreateRootFolder_() {
  const it = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
}

function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID');
  let ss;
  if (id) { ss = SpreadsheetApp.openById(id); }
  else {
    ss = SpreadsheetApp.create('ATT Florida – Reservations');
    props.setProperty('SHEET_ID', ss.getId());
    DriveApp.getFileById(ss.getId()).moveTo(getOrCreateRootFolder_());
  }
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.getSheets()[0].setName(SHEET_NAME);
    sh.appendRow(['Received', 'Package', 'Name', 'Email', 'Phone', 'Residence', 'Travelers', 'Room',
      'Flights', 'Payment', 'Plan', 'Plan details', 'Questions', 'Notes', 'Emergency contact', 'Emergency phone', 'Travelers & passports', 'Folder', 'Status']);
    sh.setFrozenRows(1);
    sh.getRange('1:1').setFontWeight('bold');
  }
  return sh;
}

function clean_(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Run once from the editor to authorize Drive, Sheets and Mail, and create the folder + sheet. */
function setup() { getOrCreateRootFolder_(); Logger.log(getSheet_().getParent().getUrl()); }
