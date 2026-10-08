/**
 * Holy Week and Pascha, day by day. Drives the Semana Santa hub
 * (/biblioteca/semanasanta) and each day page (/biblioteca/semanasanta/:slug).
 *
 * A score belongs to a day through that day's `context:` tag, and to a
 * service within the day through its `service:` tag.
 *
 * Days are the day a service is SUNG, not its liturgical day. Holy Week
 * Matins is served the evening before, so "Maitines de los 12 Evangelios"
 * (Matins of Holy Friday) is listed, and tagged, under Jueves Santo. Services
 * within a day are in the order they are sung, morning to night.
 */
export type HolyWeekService = {
  /** `service:` tag that puts a score under this heading. */
  tag: string
  /** Heading for this day, more specific than the tag's generic label. */
  label: string
}

export type HolyWeekDay = {
  /** URL segment; also the value of the `context:` tag. */
  slug: string
  label: string
  services: HolyWeekService[]
}

export const HOLY_WEEK_DAYS: HolyWeekDay[] = [
  {
    slug: 'sabado-lazaro',
    label: 'Sábado de Lázaro',
    services: [
      { tag: 'service:divina-liturgia', label: 'Divina Liturgia' },
      { tag: 'service:visperas', label: 'Vigilia del Domingo de Ramos' },
    ],
  },
  {
    slug: 'domingo-de-ramos',
    label: 'Domingo de Ramos',
    services: [
      { tag: 'service:divina-liturgia', label: 'Divina Liturgia' },
      { tag: 'service:maitines', label: 'Maitines del Novio' },
    ],
  },
  {
    slug: 'lunes-santo',
    label: 'Lunes Santo',
    services: [
      { tag: 'service:divina-liturgia', label: 'Liturgia de los Dones Presantificados' },
      { tag: 'service:maitines', label: 'Maitines del Novio' },
    ],
  },
  {
    slug: 'martes-santo',
    label: 'Martes Santo',
    services: [
      { tag: 'service:divina-liturgia', label: 'Liturgia de los Dones Presantificados' },
      { tag: 'service:maitines', label: 'Maitines del Novio' },
    ],
  },
  {
    slug: 'miercoles-santo',
    label: 'Miércoles Santo',
    services: [
      { tag: 'service:divina-liturgia', label: 'Liturgia de los Dones Presantificados' },
      { tag: 'service:uncion', label: 'Santa Unción' },
      { tag: 'service:maitines', label: 'Maitines del Jueves Santo' },
    ],
  },
  {
    slug: 'jueves-santo',
    label: 'Jueves Santo',
    services: [
      { tag: 'service:visperas', label: 'Vísperas con Liturgia de San Basilio' },
      { tag: 'service:maitines', label: 'Maitines de los 12 Evangelios' },
    ],
  },
  {
    slug: 'viernes-santo',
    label: 'Viernes Santo',
    services: [
      { tag: 'service:horas', label: 'Horas Reales' },
      { tag: 'service:visperas', label: 'Vísperas del Descenso de la Cruz' },
      { tag: 'service:maitines', label: 'Maitines del Sábado Santo (Lamentaciones)' },
    ],
  },
  {
    slug: 'sabado-santo',
    label: 'Sábado Santo',
    services: [
      { tag: 'service:visperas', label: 'Vísperas con Liturgia de San Basilio' },
      { tag: 'service:maitines', label: 'Maitines de Resurrección' },
    ],
  },
  {
    slug: 'pascua',
    label: 'Domingo de Pascua',
    services: [
      { tag: 'service:divina-liturgia', label: 'Divina Liturgia' },
      { tag: 'service:visperas', label: 'Vísperas de Ágape' },
    ],
  },
]

export function holyWeekContextTag(day: HolyWeekDay): string {
  return `context:${day.slug}`
}
