import askseeditDirectory from '../../data/seedit-directories/seedit-askseedit-directory.json';
import awwDirectory from '../../data/seedit-directories/seedit-aww-directory.json';
import directoryDefaults from '../../data/seedit-directories/seedit-directories-defaults.json';
import funnyDirectory from '../../data/seedit-directories/seedit-funny-directory.json';
import gamingDirectory from '../../data/seedit-directories/seedit-gaming-directory.json';
import interestingasfuckDirectory from '../../data/seedit-directories/seedit-interestingasfuck-directory.json';
import memesDirectory from '../../data/seedit-directories/seedit-memes-directory.json';
import newsDirectory from '../../data/seedit-directories/seedit-news-directory.json';
import picsDirectory from '../../data/seedit-directories/seedit-pics-directory.json';
import todayilearnedDirectory from '../../data/seedit-directories/seedit-todayilearned-directory.json';
import videosDirectory from '../../data/seedit-directories/seedit-videos-directory.json';
import { isDirectoryCode, type SeeditDirectoryCode } from './directory-codes';
import { normalizeDirectoryDefaultsData, normalizeDirectoryList, type DirectoryList } from './directory-list-utils';

const rawDirectoryLists = {
  askseedit: askseeditDirectory,
  memes: memesDirectory,
  news: newsDirectory,
  pics: picsDirectory,
  todayilearned: todayilearnedDirectory,
  interestingasfuck: interestingasfuckDirectory,
  gaming: gamingDirectory,
  videos: videosDirectory,
  funny: funnyDirectory,
  aww: awwDirectory,
} satisfies Record<SeeditDirectoryCode, unknown>;

export const vendoredDirectoryDefaults = normalizeDirectoryDefaultsData(directoryDefaults);

export const vendoredDirectoryLists = Object.fromEntries(
  Object.entries(rawDirectoryLists).map(([directoryCode, rawList]) => {
    const list = normalizeDirectoryList(rawList, directoryCode, vendoredDirectoryDefaults);
    if (!list) throw new Error(`Invalid vendored Seedit directory list: ${directoryCode}`);
    return [directoryCode, list];
  }),
) as Record<SeeditDirectoryCode, DirectoryList>;

export const getVendoredDirectoryList = (directoryCode: string | undefined): DirectoryList | null =>
  directoryCode && isDirectoryCode(directoryCode) ? vendoredDirectoryLists[directoryCode] : null;
