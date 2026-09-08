import React, { useState, useEffect } from "react";
import { Download, X, Smartphone, Share2, PlusSquare } from "lucide-react";

export default function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode (already installed as PWA)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
                         window.navigator.standalone === true;
    if (isStandalone) return;

    // 2. Check if iOS
    const userAgent = window.navigator.userAgent || "";
    const isIosDevice = /iPhone|iPad|iPod/i.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Listen for native Android/Desktop Chrome beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 4. On mobile devices, if not dismissed in this session, show the banner
    const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);
    const dismissed = sessionStorage.getItem("msc_pwa_banner_dismissed");
    if (isMobile && !dismissed) {
      setShowBanner(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      // If browser has not triggered prompt yet or on iOS, show friendly instructions
      setShowInstructionsModal(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem("msc_pwa_banner_dismissed", "true");
  };

  if (!showBanner && !showInstructionsModal) return null;

  return (
    <>
      {showBanner && (
        <div style={{
          position: "fixed",
          bottom: "16px",
          left: "16px",
          right: "16px",
          zIndex: 99999,
          maxWidth: "480px",
          margin: "0 auto",
          backgroundColor: "#0f766e",
          color: "#ffffff",
          borderRadius: "16px",
          padding: "14px 16px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          direction: "rtl",
          fontFamily: "Cairo, sans-serif",
          animation: "slideUp 0.3s ease-out"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              boxShadow: "0 2px 5px rgba(0,0,0,0.15)"
            }}>
              <img src="./default_logo.png" alt="Logo" style={{ width: "36px", height: "36px", objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ fontWeight: "bold", fontSize: "14px", lineHeight: "1.3" }}>
                تثبيت تطبيق مدارس المتقدمة
              </div>
              <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>
                تصفح أسرع وبملء الشاشة بدون متصفح
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={handleInstallClick}
              style={{
                backgroundColor: "#ffffff",
                color: "#0f766e",
                border: "none",
                borderRadius: "10px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}
            >
              <Download size={15} />
              <span>تثبيت</span>
            </button>

            <button
              onClick={handleDismiss}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.75)",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center"
              }}
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {showInstructionsModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.65)",
          zIndex: 100000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          direction: "rtl",
          fontFamily: "Cairo, sans-serif"
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "20px",
            maxWidth: "400px",
            width: "100%",
            padding: "24px",
            textAlign: "center",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)"
          }}>
            <div style={{
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              backgroundColor: "#f0fdf4",
              color: "#0f766e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}>
              <Smartphone size={32} />
            </div>

            <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "#1e293b", marginBottom: "8px" }}>
              كيفية تثبيت التطبيق على هاتفك
            </h3>

            {isIOS ? (
              <div style={{ textAlign: "right", fontSize: "14px", color: "#475569", lineHeight: "1.8", margin: "16px 0" }}>
                <p>1. اضغط على زر <strong>المشاركة <Share2 size={16} style={{ display: "inline", verticalAlign: "middle" }} /></strong> أسفل شاشة Safari.</p>
                <p>2. مرر للأسفل واختر <strong>"إضافة إلى الشاشة الرئيسية" <PlusSquare size={16} style={{ display: "inline", verticalAlign: "middle" }} /></strong>.</p>
                <p>3. اضغط على <strong>إضافة (Add)</strong> في أعلى الزاوية.</p>
              </div>
            ) : (
              <div style={{ textAlign: "right", fontSize: "14px", color: "#475569", lineHeight: "1.8", margin: "16px 0" }}>
                <p>1. اضغط على زر القائمة (<strong>الثلاث نقاط ⋮</strong>) بأعلى زاوية متصفح كروم.</p>
                <p>2. اختر <strong>"تثبيت التطبيق" (Install app)</strong> أو <strong>"إضافة إلى الشاشة الرئيسية"</strong>.</p>
                <p>3. اضغط على <strong>تثبيت (Install)</strong> لتثبيته فوراً على هاتفك.</p>
              </div>
            )}

            <button
              onClick={() => setShowInstructionsModal(false)}
              style={{
                width: "100%",
                backgroundColor: "#0f766e",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                padding: "12px",
                fontSize: "15px",
                fontWeight: "bold",
                cursor: "pointer",
                marginTop: "12px"
              }}
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
}

