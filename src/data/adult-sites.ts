/** Official homepages only. The app never embeds, scrapes, or restreams these sites. */
export type AdultSite = { name: string; host: string; url: string }

export const ADULT_SITES: AdultSite[] = [
  { name: 'Pornhub', host: 'www.pornhub.com', url: 'https://www.pornhub.com/' },
  { name: 'XVideos', host: 'www.xvideos.com', url: 'https://www.xvideos.com/' },
  { name: 'XNXX', host: 'www.xnxx.com', url: 'https://www.xnxx.com/' },
  { name: 'xHamster', host: 'xhamster.com', url: 'https://xhamster.com/' },
  { name: 'RedTube', host: 'www.redtube.com', url: 'https://www.redtube.com/' },
  { name: 'YouPorn', host: 'www.youporn.com', url: 'https://www.youporn.com/' },
]
