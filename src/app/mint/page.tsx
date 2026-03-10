"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useWallet } from "@/lib/wallet";
import { useMintNFT } from "@/hooks/useMintNFT";
import { Loader2, Upload, ExternalLink, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { explorerTxUrl } from "@/lib/sui-utils";

export default function MintPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const { connected, address } = useWallet();
  const { mint, isUploading, isMinting, isConfirming, isConfirmed, isProcessing, txHash } =
    useMintNFT();

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      toast({
        title: "📷 Image Selected",
        description: `File "${selectedFile.name}" ready for upload.`,
      });
    }
  };

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      handleFileChange(event.dataTransfer.files);
    },
    []
  );

  const handleMint = async () => {
    if (!file || !name || !description) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all fields and select an image.",
        variant: "destructive",
      });
      return;
    }

    if (!connected || !address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your Sui wallet first.",
        variant: "destructive",
      });
      return;
    }

    await mint(file, name, description);
  };

  // Reset form after successful mint
  React.useEffect(() => {
    if (isConfirmed) {
      setFile(null);
      setPreviewUrl(null);
      setName("");
      setDescription("");
    }
  }, [isConfirmed]);

  // Step indicator
  const currentStep = isUploading ? 1 : isMinting ? 2 : isConfirming ? 3 : isConfirmed ? 4 : 0;

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-80px)] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <Card className="w-full transition-all duration-300 hover:shadow-xl hover:shadow-primary/5">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Create Your NFT</CardTitle>
            <CardDescription className="text-center">
              Upload your artwork and mint it as a unique NFT on{" "}
              <span className="font-semibold text-primary">Sui</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Steps */}
            {isProcessing && (
              <div className="flex items-center justify-between text-xs mb-2">
                {["Upload IPFS", "Sign Tx", "Confirming", "Done"].map((label, i) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        currentStep > i + 1
                          ? "bg-green-500 text-white"
                          : currentStep === i + 1
                          ? "bg-primary text-primary-foreground animate-pulse"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {currentStep > i + 1 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span
                      className={currentStep === i + 1 ? "font-semibold" : "text-muted-foreground"}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Image Upload */}
            <div
              className="border-2 border-dashed border-muted-foreground/50 rounded-lg p-8 text-center cursor-pointer transition-all duration-300 ease-in-out hover:bg-accent hover:border-primary/50 hover:scale-[1.01] hover:shadow-md"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFileChange(e.target.files)}
              />
              {previewUrl ? (
                <div className="relative w-full h-64">
                  <Image
                    src={previewUrl}
                    alt="Preview"
                    fill
                    className="rounded-md object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                  <Upload className="w-12 h-12" />
                  <p>Drag & drop your image here, or click to select</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                placeholder='e.g. "Sunset Over the Mountains"'
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isProcessing}
                className="transition-all duration-200 focus:scale-[1.01]"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                placeholder="A beautiful painting capturing the serene sunset..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isProcessing}
                className="transition-all duration-200 focus:scale-[1.01]"
              />
            </div>

            {/* Wallet warnings */}
            {!connected && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200 transition-all duration-300">
                ⚠️ Please connect your Sui wallet using the button in the navigation bar.
              </div>
            )}

            {/* Tx hash display */}
            {txHash && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm text-green-800 dark:text-green-200">
                🎉 Transaction:{" "}
                <a
                  href={explorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono hover:underline inline-flex items-center gap-1"
                >
                  {txHash.slice(0, 12)}...{txHash.slice(-8)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <Button
              onClick={handleMint}
              disabled={isProcessing || !connected}
              className="w-full transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading to IPFS...
                </>
              ) : isMinting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirm in Wallet...
                </>
              ) : isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming on Sui...
                </>
              ) : (
                "Mint NFT on Sui"
              )}
            </Button>

            {/* Faucet info */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold">💡 First time on Sui Testnet?</p>
              <p>
                You need testnet SUI for gas fees. Get some from the{" "}
                <a
                  href="https://discord.gg/sui"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Sui Discord ↗
                </a>{" "}
                or run{" "}
                <code className="font-mono bg-muted px-1 rounded">sui client faucet</code> in your
                terminal.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
