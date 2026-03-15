"use client";

import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

type FileUploadProps = {
  onUploadComplete: (documentId: string) => void;
};

type UploadState = "idle" | "uploading" | "done";

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState<string>("");

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const selectedFile = acceptedFiles[0];
      if (!selectedFile) {
        return;
      }

      setUploadState("uploading");
      setFileName(selectedFile.name);

      try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = (await response.json()) as { documentId?: string };
        if (!data.documentId) {
          throw new Error("Upload did not return a documentId");
        }

        setUploadState("done");
        onUploadComplete(data.documentId);
      } catch (error) {
        console.error("Upload error:", error);
        setUploadState("idle");
      }
    },
    [onUploadComplete],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    multiple: false,
    disabled: uploadState === "uploading",
  });

  return (
    <div
      {...getRootProps()}
      className={`w-full rounded-xl border-2 border-dashed p-8 text-center transition ${
        uploadState === "uploading"
          ? "cursor-not-allowed border-zinc-300 bg-zinc-50"
          : isDragActive
            ? "cursor-pointer border-blue-500 bg-blue-50"
            : "cursor-pointer border-zinc-300 bg-white hover:border-zinc-400"
      }`}
    >
      <input {...getInputProps()} />

      {uploadState === "idle" && (
        <div className="flex flex-col items-center gap-3">
          <Upload className="h-8 w-8 text-zinc-500" />
          <p className="text-sm font-medium text-zinc-700">
            Drag and drop a PDF here, or click to select
          </p>
        </div>
      )}

      {uploadState === "uploading" && (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
          <p className="text-sm font-medium text-zinc-700">{fileName}</p>
        </div>
      )}

      {uploadState === "done" && (
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <p className="text-sm font-medium text-zinc-700">{fileName}</p>
        </div>
      )}
    </div>
  );
}
