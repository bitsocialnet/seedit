// Image, video, and audio file extensions from ext-list 2.2.2, the MIME table the app
// previously bundled through ext-name. Only the media categories are kept: the full
// table added ~190 KB to the JavaScript that must load before the first render.
export const MEDIA_EXTENSIONS = {
  image:
    '3ds apng avci avcs avif azv b16 bmp btf btif cgm cmx dds dib djv djvu dng dpx drle dwg dxf emf exr fbs fh fh4 fh5 fh7 fhc fits fpx fst g3 gif heic heics heif heifs hej2 ico ief jaii jais jfif jhc jls jng jp2 jpe jpeg jpf jpg jpg2 jph jpx jxl jxr jxra jxrs jxs jxsc jxsi jxss ktx ktx2 mdi mmr npx pbm pct pcx pgm pic png pnm ppm psd pti ras rgb rlc sgi sid svg svgz t38 tap tfx tga tif tiff uvg uvi uvvg uvvi vtf wbmp wdp webp wmf xbm xif xpm xwd',
  video:
    '3g2 3gp 3gpp asf asx avi dvb f4v fli flv fvt h261 h263 h264 jpgm jpgv jpm m1v m2t m2ts m2v m4s m4u m4v mj2 mjp2 mk3d mks mkv mng mov movie mp4 mp4v mpe mpeg mpg mpg4 mts mxu ogv pyv qt smv ts uvh uvm uvp uvs uvu uvv uvvh uvvm uvvp uvvs uvvu uvvv viv vob webm wm wmv wmx wvx',
  audio:
    'aac adp adts aif aifc aiff amr au caf dra dts dtshd ecelp4800 ecelp7470 ecelp9600 eol flac kar lvp m2a m3a m3u m4a m4b mid midi mka mp2 mp2a mp3 mp4a mpga mxmf oga ogg opus pya ra ram rip rmi rmp s3m sil snd spx uva uvva wav wax weba wma xm',
} as const;
