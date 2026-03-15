"use client";

import type { LogEntry } from "@/lib/types";

type EventLogProps = {
  events: LogEntry[];
};

export function EventLog({ events }: EventLogProps) {
  return (
    <section className="panel panel--grow">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Monitor</p>
          <h2 className="panel__title">Event Log</h2>
        </div>
        <span className="badge badge--muted">{events.length} events</span>
      </div>

      <div className="event-log">
        {events.length === 0 ? (
          <p className="subtle">No events yet. Connect transport to begin.</p>
        ) : (
          events
            .slice()
            .reverse()
            .map((event) => (
              <article key={event.id} className={`event-log__item event-log__item--${event.level}`}>
                <header className="event-log__meta">
                  <span>{event.type}</span>
                  <time>{event.at}</time>
                </header>
                <p>{event.message}</p>
              </article>
            ))
        )}
      </div>
    </section>
  );
}
