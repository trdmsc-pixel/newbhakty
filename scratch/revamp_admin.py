import os

file_path = "/Users/shyamsharma/Desktop/WORK/3.5 port/newbhakty/src/components/AdminPanel.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. State Injection
state_find = '  const [activeTab, setActiveTab] = useState<"settings" | "navigation" | "portfolio" | "pricing" | "assets" | "submissions" | "analytics" | "intake_form">("settings");'
state_inject = """  const [activeTab, setActiveTab] = useState<"settings" | "navigation" | "portfolio" | "pricing" | "assets" | "submissions" | "analytics" | "intake_form">("settings");

  const [uploadModal, setUploadModal] = useState<{
    active: boolean;
    filename: string;
    filesize: string;
    percentage: number;
    statusText: string;
  }>({
    active: false,
    filename: "",
    filesize: "",
    percentage: 0,
    statusText: "",
  });

  const runUploadWithModal = async (file: File, uploadFn: () => Promise<string>): Promise<string> => {
    const sizeKb = (file.size / 1024).toFixed(2) + " KB";
    setUploadModal({
      active: true,
      filename: file.name,
      filesize: sizeKb,
      percentage: 0,
      statusText: "Initiating upload handshake...",
    });

    const interval = setInterval(() => {
      setUploadModal((prev) => {
        if (!prev.active) {
          clearInterval(interval);
          return prev;
        }
        if (prev.percentage < 92) {
          const increment = Math.max(1, Math.floor(Math.random() * 6));
          const nextPercent = Math.min(92, prev.percentage + increment);
          return {
            ...prev,
            percentage: nextPercent,
            statusText: nextPercent < 30 ? "Negotiating security cipher keys..." :
                       nextPercent < 60 ? "Transporting file segments to Cloudinary CDN..." :
                       "Syncing cache nodes at edges...",
          };
        }
        return prev;
      });
    }, 150);

    try {
      const url = await uploadFn();
      clearInterval(interval);
      setUploadModal((prev) => ({
        ...prev,
        percentage: 100,
        statusText: "Ingestion and edge cache syncing completed!",
      }));
      await new Promise((resolve) => setTimeout(resolve, 800));
      setUploadModal((prev) => ({ ...prev, active: false }));
      return url;
    } catch (err: any) {
      clearInterval(interval);
      setUploadModal((prev) => ({
        ...prev,
        percentage: 0,
        statusText: `Handshake rejected: ${err?.message || "Unknown Error"}`,
      }));
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setUploadModal((prev) => ({ ...prev, active: false }));
      throw err;
    }
  };"""

content = content.replace(state_find, state_inject)

# 2. Asset Upload Wrap
asset_upload_find = """  const handleAssetUpload = async () => {
    if (!selectedAssetFile) {
      toast.warning("Please choose a file first.");
      return;
    }

    setIsUploadingAsset(true);
    toast.info("Configuring cloud pipeline. Transferring file...");

    try {
      const uploadedUrl = await uploadToCloudinary(selectedAssetFile, (progress) => {
        console.log(progress);
      });

      const newAsset = await addMediaAsset(
        newAssetName || selectedAssetFile.name,
        uploadedUrl,
        newAssetType as "image" | "video"
      );

      if (newAsset) {
        toast.success(`Success: ${newAssetName || selectedAssetFile.name} loaded and persisted!`);
        setSelectedAssetFile(null);
        setNewAssetName("");
      } else {
        toast.error("Failed to persist uploaded asset details to the database.");
      }
    } catch (err: any) {
      toast.error(`Upload error: ${err?.message || "Verify your Cloudinary setup & connection."}`);
    } finally {
      setIsUploadingAsset(false);
    }
  };"""

asset_upload_replace = """  const handleAssetUpload = async () => {
    if (!selectedAssetFile) {
      toast.warning("Please choose a file first.");
      return;
    }

    setIsUploadingAsset(true);
    try {
      const uploadedUrl = await runUploadWithModal(selectedAssetFile, () => 
        uploadToCloudinary(selectedAssetFile)
      );

      const newAsset = await addMediaAsset(
        newAssetName || selectedAssetFile.name,
        uploadedUrl,
        newAssetType as "image" | "video"
      );

      if (newAsset) {
        toast.success(`Success: ${newAssetName || selectedAssetFile.name} loaded and persisted!`);
        setSelectedAssetFile(null);
        setNewAssetName("");
      } else {
        toast.error("Failed to persist uploaded asset details to the database.");
      }
    } catch (err: any) {
      toast.error(`Upload error: ${err?.message || "Verify your Cloudinary setup & connection."}`);
    } finally {
      setIsUploadingAsset(false);
    }
  };"""

content = content.replace(asset_upload_find, asset_upload_replace)

# 3. Portfolio Upload Wrap
portfolio_upload_find = """  const handlePortfolioUpload = async (workId: string) => {
    const file = selectedPortfolioFiles[workId];
    if (!file) {
      toast.warning("Please choose a local file first.");
      return;
    }

    const targetWork = editWorks.find(w => w.id === workId);
    const isImage = targetWork?.type === "image";

    setIsUploadingPortfolioId(workId);
    toast.info(isImage ? "Uploading image to Cloudinary CDN..." : "Uploading video track to Cloudinary CDN...");

    try {
      recordWorksHistory();
      const uploadedUrl = await uploadToCloudinary(file);
      if (isImage) {
        handleWorkChange(workId, "imageUrl", uploadedUrl);
      } else {
        handleWorkChange(workId, "videoUrl", uploadedUrl);
        handleWorkChange(workId, "highResVideoUrl", uploadedUrl);
      }
      
      setSelectedPortfolioFiles(prev => ({ ...prev, [workId]: null }));
      toast.success(`File '${file.name}' successfully uploaded!`);
    } catch (err: any) {
      toast.error(`File upload failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsUploadingPortfolioId(null);
    }
  };"""

portfolio_upload_replace = """  const handlePortfolioUpload = async (workId: string) => {
    const file = selectedPortfolioFiles[workId];
    if (!file) {
      toast.warning("Please choose a local file first.");
      return;
    }

    const targetWork = editWorks.find(w => w.id === workId);
    const isImage = targetWork?.type === "image";

    setIsUploadingPortfolioId(workId);
    try {
      recordWorksHistory();
      const uploadedUrl = await runUploadWithModal(file, () => 
        uploadToCloudinary(file)
      );
      if (isImage) {
        handleWorkChange(workId, "imageUrl", uploadedUrl);
      } else {
        handleWorkChange(workId, "videoUrl", uploadedUrl);
        handleWorkChange(workId, "highResVideoUrl", uploadedUrl);
      }
      
      setSelectedPortfolioFiles(prev => ({ ...prev, [workId]: null }));
      toast.success(`File '${file.name}' successfully uploaded!`);
    } catch (err: any) {
      toast.error(`File upload failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsUploadingPortfolioId(null);
    }
  };"""

content = content.replace(portfolio_upload_find, portfolio_upload_replace)

# 4. Inject JSX modal at the end of the file
final_jsx_find = """        </div>
      </div>
    </div>
  );
}"""

final_jsx_replace = """          {/* CUSTOM GLOWING UPLOAD MODAL (Replicating Image 4 style) */}
          <AnimatePresence>
            {uploadModal.active && (
              <div className="fixed inset-0 z-[999] bg-[#050508]/85 backdrop-blur-2xl flex items-center justify-center p-4">
                {/* Red Glowing Halo/Backlight Behind Card */}
                <div className="absolute w-[350px] h-[350px] bg-red-600/15 rounded-full filter blur-[120px] pointer-events-none animate-pulse" />
                
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  transition={{ type: "spring", stiffness: 150, damping: 18 }}
                  className="glass-panel-heavy rounded-3xl p-8 max-w-md w-full border border-red-500/25 relative flex flex-col items-center text-center shadow-2xl bg-[#080203]/90"
                >
                  {/* Top glossy edge line */}
                  <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
                  
                  {/* File Icon Block */}
                  <div className="w-16 h-16 rounded-2xl bg-red-950/20 border border-red-500/20 flex items-center justify-center mb-6 relative overflow-hidden">
                    <FileText className="w-8 h-8 text-red-500" />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 border border-white/10 text-[7px] font-mono text-white tracking-widest uppercase">
                      {uploadModal.filename.split('.').pop() || "FILE"}
                    </div>
                  </div>

                  {/* File Name & Size */}
                  <h3 className="font-display font-medium text-lg text-white mb-1 truncate max-w-xs">
                    {uploadModal.filename}
                  </h3>
                  <p className="text-gray-400 font-mono text-[10px] uppercase tracking-wider mb-6">
                    {uploadModal.filesize}
                  </p>

                  {/* Progress Bar Container */}
                  <div className="w-full bg-[#110506] border border-white/5 rounded-full p-1 mb-4 relative overflow-hidden">
                    {/* Progress bar track fill */}
                    <div 
                      className="h-2 rounded-full bg-gradient-to-r from-red-600 to-red-400 relative transition-all duration-300 ease-out"
                      style={{ width: `${uploadModal.percentage}%` }}
                    >
                      {/* Bright Laser-tipped white highlight */}
                      <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_#fff]" />
                    </div>
                  </div>

                  {/* Progress readouts */}
                  <div className="flex justify-between items-center w-full mb-1">
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest animate-pulse">
                      {uploadModal.percentage === 100 ? "Syncing CDN..." : "Uploading..."}
                    </span>
                    <span className="text-sm font-display font-semibold text-white">
                      {uploadModal.percentage}%
                    </span>
                  </div>

                  <p className="text-[10px] text-red-400 font-mono italic mt-2 text-center max-w-xs line-clamp-1">
                    {uploadModal.statusText}
                  </p>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}"""

content = content.replace(final_jsx_find, final_jsx_replace)

# 5. Accent color bulk search-and-replace
content = content.replace("E6C687", "e60027")
content = content.replace("ebd5ad", "ff3b30")
content = content.replace("fadfa8", "ff1236")

# Also replace text-black on bg-red button styles
# e.g., bg-[#e60027] text-black -> bg-[#e60027] text-white
content = content.replace("bg-[#e60027] text-black", "bg-[#e60027] text-white")
content = content.replace("bg-[#E6C687] text-black", "bg-[#e60027] text-white")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("AdminPanel.tsx successfully modified!")
