"use client";

import { useState } from "react";
import Container from "@/components/Container";
import Button from "@/components/ui/Button";

type Props = {
  title?: string;
  subtitle?: string;
  placeholder?: string;
  ctaLabel?: string;
};

export default function SectionNewsletter(props: Props) {
  const [email, setEmail] = useState("");

  return (
    <section aria-label="Newsletter" className="py-12">
      <Container>
        <div
          className="rounded-2xl border border-border px-6 py-8 text-primary-contrast shadow-sm"
          style={{
            background:
              "linear-gradient(90deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary-hover)) 50%, rgb(var(--color-primary)) 100%)",
          }}
        >
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="text-balance text-2xl font-semibold smart-wrap">{props.title ?? "Newsletter"}</h2>
            {props.subtitle ? (
              <p className="mt-1 text-sm text-white/90 smart-wrap">{props.subtitle}</p>
            ) : null}
          </div>

          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              alert(`Iscrizione mock: ${email || "(email vuota)"}`);
              setEmail("");
            }}
          >
            <label className="sr-only" htmlFor="newsletter-email">
              Email
            </label>
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={props.placeholder ?? "nome@esempio.it"}
              className="h-11 w-full rounded-xl border border-white/25 bg-white/95 px-3 text-sm text-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-white sm:w-[320px]"
            />
            <Button type="submit">{props.ctaLabel ?? "Iscrivimi"}</Button>
          </form>
        </div>
        </div>
      </Container>
    </section>
  );
}
