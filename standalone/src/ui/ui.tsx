import * as React from "react";
import { Sidebar } from "./sidebar";
import { Button } from "@fluentui/react-components";
import { AppsListRegular } from "@fluentui/react-icons";
import { makeStyles } from '@fluentui/react-components';

const sidebarButtonStyle = makeStyles({
    button: {
        position: "fixed",
        top: "2%",
        right: "2%"
    },
});

const UIContainer = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const styles = sidebarButtonStyle();
  return (
    <div style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}>
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <Button
        size="large"
        icon={<AppsListRegular style={{ color: "white" }} />}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={styles.button}
        appearance="subtle"
      />
    </div>
  );
};

export default UIContainer;