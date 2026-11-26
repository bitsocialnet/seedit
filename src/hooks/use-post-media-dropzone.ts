import { useState } from 'react';
import { ErrorCode, useDropzone, type FileRejection } from 'react-dropzone';
import { Capacitor } from '@capacitor/core';
import type { AttachedMedia } from '../lib/media-hosting';
import { startPostingAnalytics } from '../lib/posting-analytics';
import usePublishPostStore from '../stores/use-publish-post-store';
import { useMediaUpload } from './use-media-upload';

const isAndroid = Capacitor.getPlatform() === 'android';

/**
 * Drop or pick a file for the post draft: it uploads to the media hosting provider set in the
 * preferences (Forge Images by default) and fills in the draft's link.
 */
const usePostMediaDropzone = () => {
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);
  const { uploadPhase, fileKinds, accept, pickAndroidMedia, rejectMedia, uploadMedia } = useMediaUpload();
  const [isChoosingFile, setIsChoosingFile] = useState(false);

  // A failed upload is a failed post attempt of its own: the post cannot carry the file.
  const upload = async (media: AttachedMedia) => {
    const url = await uploadMedia(media, () => startPostingAnalytics({ kind: 'post' }).finish('post_upload_failed'));
    if (url) setPublishPostStore({ link: url });
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      // A drop of several files rejects them all as too many; the first supported one still uploads.
      const file = acceptedFiles[0] ?? fileRejections.find(({ errors }) => errors.every((error) => error.code === ErrorCode.TooManyFiles))?.file;
      if (file) {
        void upload({ kind: 'file', file, name: file.name, mimeType: file.type });
        return;
      }
      // A format no enabled provider takes: say so rather than ignore the drop.
      const rejected = fileRejections[0]?.file;
      if (rejected) rejectMedia({ kind: 'file', file: rejected, name: rejected.name, mimeType: rejected.type });
    },
    noClick: true,
    multiple: false,
    disabled: uploadPhase !== null,
    // Only the formats the enabled providers host.
    accept,
  });

  const chooseFile = async () => {
    if (uploadPhase || isChoosingFile) return;
    if (!isAndroid) {
      open();
      return;
    }
    // The native picker keeps the file native-side, so a video never crosses the bridge as base64.
    setIsChoosingFile(true);
    const media = await pickAndroidMedia();
    setIsChoosingFile(false);
    if (media) await upload(media);
  };

  // fileKinds is empty when uploads are turned off in the preferences.
  return { fileKinds, uploadPhase, getRootProps, getInputProps, isDragActive, chooseFile };
};

export default usePostMediaDropzone;
