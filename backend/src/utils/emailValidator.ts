/**
 * E-Mail Validierung
 * - Wegwerf-E-Mail Adressen blockieren
 * - Echte E-Mail Syntax prüfen
 * - DNS MX-Record Prüfung (optional)
 */

// Bekannte Wegwerf-E-Mail Anbieter (laufend erweiterbar)
const DISPOSABLE_DOMAINS = new Set([
  // Klassiker
  'mailinator.com','guerrillamail.com','guerrillamail.net','guerrillamail.org',
  'guerrillamail.de','guerrillamail.info','guerrillamailblock.com',
  'sharklasers.com','guerrillamailblock.com','grr.la','guerrillamail.biz',
  'spam4.me','yopmail.com','yopmail.fr','cool.fr.nf','jetable.fr.nf',
  'nospam.ze.tc','nomail.xl.cx','mega.zik.dj','speed.1s.fr',
  'courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf',
  'monmail.fr.nf','tempmail.com','temp-mail.org','tempr.email',
  'dispostable.com','mailnull.com','spamgourmet.com',
  'trashmail.com','trashmail.me','trashmail.at','trashmail.io',
  'trashmail.net','trashmail.org','trashmail.xyz',
  'throwam.com','throwam.info','throwaway.email',
  'fakeinbox.com','fakeinbox.net','fakeinbox.org',
  'mailnesia.com','mailnull.com','maildrop.cc',
  'spambox.us','spambox.info','spambox.irishspringrealty.com',
  'spamgob.com','spamhereplease.com','spamhole.com',
  'spamify.com','spaminator.de','spamkill.info',
  'spaml.com','spaml.de','spammotel.com','spamoff.de',
  'spamslicer.com','spamspot.com','spamstack.net',
  'spamthis.co.uk','spamthisplease.com','spamtrail.com',
  'spamtroll.net','spamwc.de','spamz.de',
  'tempinbox.com','tempinbox.co.uk','temporaryinbox.com',
  'tempemail.net','tempemail.com','tempail.com',
  'getairmail.com','filzmail.com','emailwarden.com',
  'emailthe.net','emailtmp.com','emailto.de',
  'eyepaste.com','fastacura.com','fastchevy.com',
  'fastem.com','fastemail.us','fastemailer.com',
  'fastemails.us','fastermail.com','fastest.cc',
  'fatflap.com','fightallspam.com','fiifke.de',
  'filzmail.com','fizmail.com','fleckens.hu',
  'frapmail.com','friendlymail.co.uk','front14.org',
  'gardenscape.ca','garliclife.com','gehensiemirnichtaufdengeist.de',
  'get1mail.com','get2mail.fr','geteit.com',
  'getmails.eu','getonemail.com','getonemail.net',
  'ghosttexter.de','gishpuppy.com','gmal.com',
  'haltospam.com','hatespam.org','hidemail.de',
  'hidzz.com','hochsitze.com','hopemail.biz',
  'hotpop.com','hulapla.de','hushmail.me',
  'ieatspam.eu','ieatspam.info','ieh-mail.de',
  'ihateyoualot.info','iheartspam.org','imails.info',
  'inoutmail.de','inoutmail.eu','inoutmail.info',
  'inoutmail.net','insorg.org','internet-e-mail.de',
  'internet-mail.de','internetemails.net','internetmailing.net',
  'inwind.it','ipoo.org','irish2me.com',
  'jetable.com','jetable.fr.nf','jetable.net',
  'jetable.org','jnxjn.com','jourrapide.com',
  'jsrsolutions.com','junk1.tk','kasmail.com',
  'kaspop.com','killmail.com','killmail.net',
  'kir.ch.tc','klassmaster.com','klassmaster.net',
  'klassmaster.org','klzlk.com','koszmail.pl',
  'kurzepost.de','letthemeatspam.com','lhsdv.com',
  'lifbee.com','link2mail.net','litedrop.com',
  'lol.ovpn.to','lolfreak.net','lookugly.com',
  'lortemail.dk','losemymail.com','lovemeleaveme.com',
  'lr78.com','lroid.com','lukop.dk',
  'MailNull.com','mail.wtf','mail2nowhere.com',
  'mailbucket.org','mailcat.biz','mailcatch.com',
  'maildrop.cc','maileater.com','maileimer.de',
  'mailexpire.com','mailf5.com','mailfall.com',
  'mailfree.ga','mailfreeonline.com','mailfs.com',
  'mailguard.me','mailhazard.com','mailhazard.us',
  'mailimate.com','mailin8r.com','mailinater.com',
  'mailinator.net','mailinator.org','mailinator.us',
  'mailinator2.com','mailincubator.com','mailismagic.com',
  'mailme.ir','mailme.lv','mailme24.com',
  'mailmetrash.com','mailmoth.com','mailnew.com',
  'mailnull.com','mailquack.com','mailrock.biz',
  'mailsac.com','mailscrap.com','mailshell.com',
  'mailsiphon.com','mailslite.com','mailsoul.com',
  'mailtome.de','mailtothis.com','mailtrash.net',
  'mailzilla.com','mailzilla.org','mbx.cc',
  'meinspamschutz.de','meltmail.com','messagebeamer.de',
  'mierdamail.com','mintemail.com','misterpinball.de',
  'mjukglass.nu','moakt.cc','moakt.co','moakt.com',
  'moakt.ws','moburl.com','moncourrier.fr.nf',
  'monemail.fr.nf','monkeymail.be','monmail.fr.nf',
  'mox.pp.ua','mt2009.com','mt2014.com','mt2015.com',
  'mymail-in.net','mymailoasis.com','mynetstore.de',
  'mypacks.net','mypartyclip.de','mysendfree.com',
  'myspaceinc.com','myspaceinc.net','myspaceinc.org',
  'netzidiot.de','newhide.com','newmail.top',
  'nice-4u.com','nincsmail.com','nwldx.com',
  'objectmail.com','obobbo.com','odnorazovoe.ru',
  'odaymail.com','oneoffemail.com','onewaymail.com',
  'oopi.org','ordinaryamerican.net','otherinbox.com',
  'ourklips.com','outlawspam.com','ovpn.to',
  'owlpic.com','pancakemail.com','paplease.com',
  'pepbot.com','perso.be','phreaker.net',
  'pimpedupmyspace.com','pjjkp.com','plexolan.de',
  'pookmail.com','postacin.com','powered.name',
  'primabananen.net','prtnx.com','punkass.com',
  'putthisinyourspamdatabase.com','qibl.at','quickinbox.com',
  'quickmail.nl','rcpt.at','reallymymail.com',
  'recode.me','recursor.net','recyclemail.dk',
  'regbypass.com','regbypass.comsafe-mail.net',
  'rtrtr.com','s0ny.net','safe-mail.net',
  'safersignup.de','safetymail.info','safetypost.de',
  'sandelf.de','schafmail.de','schrott-email.de',
  'secretemail.de','secure-mail.biz','selfdestructingmail.com',
  'sendspamhere.com','sharklasers.com','shieldemail.com',
  'shiftmail.com','shitmail.me','shitmail.org',
  'shitware.nl','shmeriously.com','shortmail.net',
  'sibmail.com','singlespeed.nl','sinnlos-mail.de',
  'skeefmail.com','slopsbox.com','smellfear.com',
  'smwg.info','snakemail.com','sneakemail.com',
  'snkmail.com','sofimail.com','sofort-mail.de',
  'sogetthis.com','soodonims.com','spam.la',
  'spam.su','spam4.me','spamavert.com',
  'spambob.com','spambob.net','spambob.org',
  'spambog.com','spambog.de','spambog.ru',
  'spambooger.com','spambox.info','spambox.us',
  'spamcannon.com','spamcannon.net','spamcero.com',
  'spamcon.org','spamcorptastic.com','spamcowboy.com',
  'spamcowboy.net','spamcowboy.org','spamday.com',
  'spamex.com','spamfree.eu','spamfree24.de',
  'spamfree24.eu','spamfree24.info','spamfree24.net',
  'spamfree24.org','spamgoes.in','spamgob.com',
  'guerrillamail.com', 'yopmail.com', 'tempmail.com',
  '10minutemail.com','10minutemail.net','10minutemail.org',
  '20minutemail.com','20minutemail.it','20minutemail.net',
  'mailexpire.com','throwam.com','discard.email',
  'dispostable.com','discardmail.com','discardmail.de',
  'inboxalias.com','inboxclean.com','inboxclean.org',
  'fakemailgenerator.com','crazymailing.com',
])

// Bekannte seriöse Provider (nicht blockieren)
const TRUSTED_DOMAINS = new Set([
  'gmail.com','googlemail.com','yahoo.com','yahoo.de','yahoo.co.uk',
  'outlook.com','hotmail.com','hotmail.de','live.com','msn.com',
  'icloud.com','me.com','mac.com','aol.com',
  'gmx.de','gmx.net','gmx.com','gmx.at','gmx.ch',
  'web.de','t-online.de','freenet.de','posteo.de',
  'tutanota.com','tutanota.de','protonmail.com','protonmail.ch',
  'pm.me','proton.me',
])

export interface EmailValidationResult {
  valid:   boolean
  reason?: string
}

export function validateEmail(email: string): EmailValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'E-Mail-Adresse fehlt' }
  }

  const trimmed = email.toLowerCase().trim()

  // Grundlegende Syntax-Prüfung
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(trimmed)) {
    return { valid: false, reason: 'Ungültige E-Mail-Adresse' }
  }

  const domain = trimmed.split('@')[1]

  // Wegwerf-Anbieter prüfen
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid:  false,
      reason: 'Wegwerf-E-Mail-Adressen sind nicht erlaubt. Bitte nutze eine echte E-Mail-Adresse.',
    }
  }

  // Verdächtige Domain-Muster
  if (
    domain.includes('temp') ||
    domain.includes('trash') ||
    domain.includes('spam') ||
    domain.includes('fake') ||
    domain.includes('disposable') ||
    domain.includes('throwaway') ||
    /^\d+min/.test(domain) ||
    /^\d+hour/.test(domain)
  ) {
    return {
      valid:  false,
      reason: 'Diese E-Mail-Domain ist nicht erlaubt. Bitte nutze eine reguläre E-Mail-Adresse.',
    }
  }

  return { valid: true }
}