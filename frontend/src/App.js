import { useState } from "react";
import Dashboard from "./components/Dashboard";
import DocumentList from "./components/DocumentList";
import UploadDocument from "./components/UploadDocument";
import SearchBar from "./components/SearchBar";
import SearchResults from "./components/SearchResults";
import WordGroups from "./components/WordGroups";
import Expressions from "./components/Expressions";
import Statistics from "./components/Statistics";
import DataMining from "./components/DataMining";
import "./App.css";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "articles", label: "Articles", icon: "☷" },
  { id: "upload", label: "Upload", icon: "↑" },
  { id: "search", label: "Search", icon: "⌕" },
  { id: "groups", label: "Word Groups", icon: "☰" },
  { id: "expressions", label: "Expressions", icon: "“" },
  { id: "statistics", label: "Statistics", icon: "≡" },
  { id: "mining", label: "Data Mining", icon: "⛏" },
];

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchResults, setSearchResults] = useState(null);
  const [searchType, setSearchType] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleUploadSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleSearchResults = (results, type) => {
    setSearchResults(results);
    setSearchType(type);
  };

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <Dashboard />;
      case "articles":
        return <DocumentList key={refreshKey} />;
      case "upload":
        return <UploadDocument onSuccess={handleUploadSuccess} />;
      case "search":
        return (
          <>
            <SearchBar onResults={handleSearchResults} />
            <SearchResults results={searchResults} type={searchType} />
          </>
        );
      case "groups":
        return <WordGroups />;
      case "expressions":
        return <Expressions />;
      case "statistics":
        return <Statistics />;
      case "mining":
        return <DataMining />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <h1>{sidebarCollapsed ? "C" : "Concordance"}</h1>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? "❯" : "❮"}
          </button>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => setActivePage(item.id)}
              title={sidebarCollapsed ? item.label : ""}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <div className="sidebar-footer">
            Text Retrieval System
          </div>
        )}
      </aside>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
