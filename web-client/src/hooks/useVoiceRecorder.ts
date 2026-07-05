import { useCallback, useRef, useState } from 'react';

type VoiceRecorderCallbacks = {
  onRecorded: (audioBlob: Blob, filename: string) => void;
  onMicrophoneDenied: () => void;
  onEmptyRecording: () => void;
};

/** Formats testés dans l'ordre : le premier supporté par le navigateur gagne. */
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function fileExtensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

/** Machine à états de l'enregistrement vocal (MediaRecorder), isolée de l'UI. */
export function useVoiceRecorder(callbacks: VoiceRecorderCallbacks): {
  recording: boolean;
  toggleRecording: () => Promise<void>;
} {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const toggleRecording = useCallback(async (): Promise<void> => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const finalType = recorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: finalType });
        if (audioBlob.size === 0) {
          callbacksRef.current.onEmptyRecording();
          return;
        }
        callbacksRef.current.onRecorded(audioBlob, `voice.${fileExtensionFor(finalType)}`);
      };
      recorderRef.current = recorder;
      // timeslice : force un flush régulier des données audio.
      recorder.start(250);
      setRecording(true);
    } catch {
      callbacksRef.current.onMicrophoneDenied();
    }
  }, []);

  return { recording, toggleRecording };
}
