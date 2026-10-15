/**
 * Holy Week and Pascha, day by day. Drives the Semana Santa hub
 * (/biblioteca/semanasanta) and each day page (/biblioteca/semanasanta/:slug).
 *
 * Each Holy Week service has its own `service:ss-…` tag, and a score belongs
 * to a service by carrying that tag. The score says nothing about the day:
 * this list is what places each service on a day.
 *
 * Days are the day a service is SUNG, not its liturgical day. Holy Week
 * Matins is served the evening before, so "Maitines de los 12 Evangelios"
 * (Matins of Holy Friday) is listed under Jueves Santo. Services within a day
 * are in the order they are sung, morning to night.
 *
 * Older tagging is still honored: a score with the day's `context:<slug>` tag
 * belongs to that day, under the service whose generic tag it carries (e.g.
 * `service:divina-liturgia`), or under "Otras piezas" when it has none.
 */
export type HolyWeekService = {
  /**
   * `service:` tags for this service. The first is the one to use; any others
   * are earlier spellings kept so already-tagged scores stay in place.
   */
  tags: string[]
  /** Generic service tag that counts only together with the day's context tag. */
  genericTag: string
  label: string
}

export type HolyWeekDay = {
  /** URL segment; also the value of the day's `context:` tag. */
  slug: string
  label: string
  services: HolyWeekService[]
}

type Taggable = { tags: string[] }

export const HOLY_WEEK_DAYS: HolyWeekDay[] = [
  {
    slug: 'sabado-lazaro',
    label: 'Sábado de Lázaro',
    services: [
      {
        tags: ['service:ss-liturgia-sabado-lazaro'],
        genericTag: 'service:divina-liturgia',
        label: 'Divina Liturgia',
      },
      {
        tags: ['service:ss-vigilia-domingo-de-ramos'],
        genericTag: 'service:visperas',
        label: 'Vigilia del Domingo de Ramos',
      },
    ],
  },
  {
    slug: 'domingo-de-ramos',
    label: 'Domingo de Ramos',
    services: [
      {
        tags: ['service:ss-liturgia-domingo-de-ramos'],
        genericTag: 'service:divina-liturgia',
        label: 'Divina Liturgia',
      },
      {
        tags: ['service:ss-maitines-lunes-santo'],
        genericTag: 'service:maitines',
        label: 'Maitines del Novio',
      },
    ],
  },
  {
    slug: 'lunes-santo',
    label: 'Lunes Santo',
    services: [
      {
        tags: ['service:ss-presantificados-lunes-santo'],
        genericTag: 'service:divina-liturgia',
        label: 'Liturgia de los Dones Presantificados',
      },
      {
        tags: ['service:ss-maitines-martes-santo'],
        genericTag: 'service:maitines',
        label: 'Maitines del Novio',
      },
    ],
  },
  {
    slug: 'martes-santo',
    label: 'Martes Santo',
    services: [
      {
        tags: ['service:ss-presantificados-martes-santo'],
        genericTag: 'service:divina-liturgia',
        label: 'Liturgia de los Dones Presantificados',
      },
      {
        tags: ['service:ss-maitines-miercoles-santo'],
        genericTag: 'service:maitines',
        label: 'Maitines del Novio',
      },
    ],
  },
  {
    slug: 'miercoles-santo',
    label: 'Miércoles Santo',
    services: [
      {
        tags: ['service:ss-presantificados-miercoles-santo'],
        genericTag: 'service:divina-liturgia',
        label: 'Liturgia de los Dones Presantificados',
      },
      {
        tags: ['service:ss-santa-uncion'],
        genericTag: 'service:uncion',
        label: 'Santa Unción',
      },
      {
        tags: ['service:ss-maitines-jueves-santo'],
        genericTag: 'service:maitines',
        label: 'Maitines del Jueves Santo',
      },
    ],
  },
  {
    slug: 'jueves-santo',
    label: 'Jueves Santo',
    services: [
      {
        tags: ['service:ss-visperas-liturgia-jueves-santo'],
        genericTag: 'service:visperas',
        label: 'Vísperas con Liturgia de San Basilio',
      },
      {
        tags: ['service:ss-maitines-12-evangelios', 'service:ss-js-maitines-viernes-santo'],
        genericTag: 'service:maitines',
        label: 'Maitines de los 12 Evangelios',
      },
    ],
  },
  {
    slug: 'viernes-santo',
    label: 'Viernes Santo',
    services: [
      {
        tags: ['service:ss-horas-reales'],
        genericTag: 'service:horas',
        label: 'Horas Reales',
      },
      {
        tags: ['service:ss-visperas-descenso-de-la-cruz'],
        genericTag: 'service:visperas',
        label: 'Vísperas del Descenso de la Cruz',
      },
      {
        tags: ['service:ss-maitines-sabado-santo'],
        genericTag: 'service:maitines',
        label: 'Maitines del Sábado Santo (Las Lamentaciones)',
      },
    ],
  },
  {
    slug: 'sabado-santo',
    label: 'Sábado Santo',
    services: [
      {
        tags: ['service:ss-visperas-liturgia-sabado-santo'],
        genericTag: 'service:visperas',
        label: 'Vísperas con Liturgia de San Basilio',
      },
      {
        tags: ['service:ss-maitines-de-resurreccion'],
        genericTag: 'service:maitines',
        label: 'Maitines de Resurrección',
      },
    ],
  },
  {
    slug: 'pascua',
    label: 'Domingo de Pascua',
    services: [
      {
        tags: ['service:ss-liturgia-pascual'],
        genericTag: 'service:divina-liturgia',
        label: 'Divina Liturgia Pascual',
      },
      {
        tags: ['service:ss-visperas-de-agape'],
        genericTag: 'service:visperas',
        label: 'Vísperas de Ágape',
      },
    ],
  },
]

function contextTag(day: HolyWeekDay): string {
  return `context:${day.slug}`
}

/** Whether the score is sung in this service of this day. */
export function isInHolyWeekService(score: Taggable, day: HolyWeekDay, service: HolyWeekService): boolean {
  if (service.tags.some((tag) => score.tags.includes(tag))) return true
  return score.tags.includes(contextTag(day)) && score.tags.includes(service.genericTag)
}

/** Whether the score belongs on this day's page, under a service or not. */
export function isOnHolyWeekDay(score: Taggable, day: HolyWeekDay): boolean {
  return (
    score.tags.includes(contextTag(day)) ||
    day.services.some((service) => service.tags.some((tag) => score.tags.includes(tag)))
  )
}

const ALL_SERVICE_LABELS = HOLY_WEEK_DAYS.flatMap((day) => day.services.map((service) => service.label))

/**
 * Display labels for the `service:ss-…` tags, for tagDisplay.ts. A label used
 * by several services ("Maitines del Novio") gets the day it is sung on, since
 * a tag chip has no day heading above it to tell them apart.
 */
export const HOLY_WEEK_TAG_LABELS: Record<string, string> = Object.fromEntries(
  HOLY_WEEK_DAYS.flatMap((day) =>
    day.services.flatMap((service) => {
      const repeated = ALL_SERVICE_LABELS.filter((label) => label === service.label).length > 1
      const label = repeated ? `${service.label} (${day.label})` : service.label
      return service.tags.map((tag) => [tag, label])
    }),
  ),
)
