import Navbar from "@/components/Navbar";
import WelcomeSection from "@/components/dashboard/WelcomeSection";
import MainActions from "@/components/dashboard/MainActions";
import ActivityOverview from "@/components/dashboard/ActivityOverview";
function dashboardPage() {
    return (
    <>
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8 pt-24">
        <WelcomeSection />
        <MainActions/>
        <ActivityOverview />
      </div>
    </>
  );
}

export default dashboardPage;