import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../core/prefs/language.service';
import { PageTitle } from '../../core/util/page-title';

/** Contact for questions about personal data. */
const CONTACT = 'milinko.miletic.dev@gmail.com';

/**
 * Privacy policy and terms of use. Kept in the template (not in the translation files): it is long
 * legal-style text that is read as a whole, in Serbian or English. It must describe what the app
 * and the backend really do - update it together with any change to the stored data.
 */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  template: `
    <article class="page policy">
      @if (language.language() === 'sr') {
        <h1 class="t-headline">Privatnost i uslovi korišćenja</h1>
        <p class="t-small t-muted">Poslednja izmena: 15. oktobar 2026.</p>

        <h2 class="t-title-lg">Ukratko</h2>
        <p>
          Movienee čuva samo ono što je potrebno da aplikacija radi: tvoj nalog, tvoje filmove i
          tvoje prijatelje. Nema reklama, analitike ni prodaje podataka. Nalog i sve podatke možeš
          da obrišeš sam, jednim dugmetom na Profilu.
        </p>

        <h2 class="t-title-lg">Šta čuvamo</h2>
        <ul>
          <li>
            <strong>Nalog:</strong> pri prijavi preko Google-a dobijamo tvoje ime, mejl adresu i
            sliku profila. Lozinku nikad ne vidimo.
          </li>
          <li><strong>Profil:</strong> korisničko ime, opis i sliku profila koje sam podesiš.</li>
          <li>
            <strong>Tvoji filmovi:</strong> listu za gledanje, odgledane filmove i ocene. Iz njih se
            računa tvoj ukus i poklapanje sa prijateljima.
          </li>
          <li><strong>Komentari</strong> na filmovima i lajkovi na komentarima.</li>
          <li><strong>Prijatelji:</strong> zahtevi za prijateljstvo i lista prijatelja.</li>
          <li>
            <strong>Obaveštenja</strong> (zahtevi, preporuke filmova od prijatelja) i, u Android
            aplikaciji, token uređaja za push obaveštenja.
          </li>
        </ul>

        <h2 class="t-title-lg">Šta ne čuvamo</h2>
        <ul>
          <li>
            <strong>Slike iz pretrage slikom</strong> šalju se Google Gemini servisu na
            prepoznavanje i ne čuvaju se kod nas.
          </li>
          <li>
            <strong>Lokaciju:</strong> ako dozvoliš pristup lokaciji, ona se koristi samo da se
            bioskopi sortiraju po udaljenosti i nigde se ne upisuje.
          </li>
        </ul>

        <h2 class="t-title-lg">Ko šta vidi</h2>
        <ul>
          <li>Prijatelji vide tvoje odgledane filmove, ocene i aktivnost.</li>
          <li>
            Ostali korisnici mogu da te pronađu po korisničkom imenu i vide samo ime, sliku i
            zajedničke žanrove, dok ne prihvatiš njihov zahtev.
          </li>
          <li>Komentari su javni na stranici filma, uz tvoje korisničko ime.</li>
        </ul>

        <h2 class="t-title-lg">Usluge koje koristimo</h2>
        <p>
          Google Firebase (prijava i hosting sajta), Render (server), Supabase (baza podataka),
          Google Gemini (pretraga slikom i pametna pretraga), TMDB (podaci i slike filmova) i
          YouTube (trejleri, u režimu bez kolačića). Repertoar i termini se preuzimaju sa javnih
          sajtova bioskopa.
        </p>

        <h2 class="t-title-lg">Podaci u pregledaču</h2>
        <p>
          Pregledač čuva jezik, temu, nedavne pretrage i ime i sliku prijavljenog korisnika, a
          Firebase čuva sesiju prijave. Ne koristimo kolačiće za praćenje ni reklame.
        </p>

        <h2 class="t-title-lg">Brisanje naloga</h2>
        <p>
          Na <a routerLink="/profile">Profilu</a> izaberi <strong>Obriši nalog</strong>. Odmah i
          trajno se brišu nalog, profil, tvoji filmovi i ocene, komentari, lajkovi, prijateljstva i
          obaveštenja, kao i prijava preko Google-a za Movienee.
        </p>

        <h2 class="t-title-lg">Uslovi korišćenja</h2>
        <ul>
          <li>Movienee je besplatan i pruža se „kakav jeste”, bez garancije.</li>
          <li>
            Repertoar, termini i cene preuzimaju se sa sajtova bioskopa i mogu da kasne ili se
            promene &mdash; pre kupovine karte proveri na sajtu bioskopa.
          </li>
          <li>
            Nije dozvoljeno objavljivati uvredljiv ili nezakonit sadržaj, niti zloupotrebljavati
            servis (npr. automatizovanim zahtevima). Takav sadržaj ili nalog može biti uklonjen.
          </li>
        </ul>

        <h2 class="t-title-lg">Kontakt</h2>
        <p>
          Pitanja o podacima i privatnosti: <a [href]="'mailto:' + contact">{{ contact }}</a>
        </p>
      } @else {
        <h1 class="t-headline">Privacy and terms of use</h1>
        <p class="t-small t-muted">Last updated: 15 October 2026</p>

        <h2 class="t-title-lg">In short</h2>
        <p>
          Movienee keeps only what the app needs to work: your account, your movies and your
          friends. No ads, no analytics, no selling of data. You can delete your account and all
          your data yourself, with one button on the Profile page.
        </p>

        <h2 class="t-title-lg">What we store</h2>
        <ul>
          <li>
            <strong>Account:</strong> when you sign in with Google we receive your name, email
            address and profile picture. We never see your password.
          </li>
          <li><strong>Profile:</strong> the username, bio and picture you set yourself.</li>
          <li>
            <strong>Your movies:</strong> your watchlist, watched movies and ratings. Your taste and
            the match with friends are calculated from them.
          </li>
          <li><strong>Comments</strong> on movies and likes on comments.</li>
          <li><strong>Friends:</strong> friend requests and your friend list.</li>
          <li>
            <strong>Notifications</strong> (requests, movies friends recommend) and, in the Android
            app, the device token for push notifications.
          </li>
        </ul>

        <h2 class="t-title-lg">What we do not store</h2>
        <ul>
          <li>
            <strong>Photos from image search</strong> are sent to Google Gemini for recognition and
            are not kept by us.
          </li>
          <li>
            <strong>Your location:</strong> if you allow it, it is used only to sort cinemas by
            distance and is never saved.
          </li>
        </ul>

        <h2 class="t-title-lg">Who sees what</h2>
        <ul>
          <li>Friends see your watched movies, ratings and activity.</li>
          <li>
            Other users can find you by username and see only your name, picture and shared genres
            until you accept their request.
          </li>
          <li>Comments are public on the movie page, with your username.</li>
        </ul>

        <h2 class="t-title-lg">Services we use</h2>
        <p>
          Google Firebase (sign-in and website hosting), Render (server), Supabase (database),
          Google Gemini (image search and smart search), TMDB (movie data and images) and YouTube
          (trailers, in privacy-enhanced mode). Cinema programmes and showtimes come from the
          cinemas' public websites.
        </p>

        <h2 class="t-title-lg">Data in your browser</h2>
        <p>
          The browser keeps your language, theme, recent searches and the signed-in user's name and
          picture, and Firebase keeps the sign-in session. We use no tracking or advertising
          cookies.
        </p>

        <h2 class="t-title-lg">Deleting your account</h2>
        <p>
          On the <a routerLink="/profile">Profile</a> page choose <strong>Delete account</strong>.
          Your account, profile, movies and ratings, comments, likes, friendships and notifications
          are deleted immediately and permanently, together with your Google sign-in for Movienee.
        </p>

        <h2 class="t-title-lg">Terms of use</h2>
        <ul>
          <li>Movienee is free and provided "as is", without warranty.</li>
          <li>
            Programmes, showtimes and prices come from the cinemas' websites and may be late or
            change &mdash; check the cinema's website before buying a ticket.
          </li>
          <li>
            Do not post offensive or illegal content or abuse the service (e.g. with automated
            requests). Such content or accounts may be removed.
          </li>
        </ul>

        <h2 class="t-title-lg">Contact</h2>
        <p>
          Questions about data and privacy: <a [href]="'mailto:' + contact">{{ contact }}</a>
        </p>
      }
    </article>
  `,
  styles: `
    .policy {
      max-width: 760px;
      padding-bottom: var(--space-7);
      line-height: 1.6;
    }
    h1 {
      margin-bottom: var(--space-1);
    }
    h2 {
      margin: var(--space-6) 0 var(--space-2);
    }
    p,
    li {
      color: var(--text-2);
    }
    ul {
      display: grid;
      gap: var(--space-2);
      padding-left: var(--space-5);
    }
    strong {
      color: var(--text);
    }
    a {
      color: var(--accent-text);
      text-decoration: underline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPage {
  protected readonly language = inject(LanguageService);
  protected readonly contact = CONTACT;

  constructor() {
    inject(PageTitle).set(inject(TranslocoService).translate('web_privacy_title'));
  }
}
