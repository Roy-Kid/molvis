import * as React from "react";
import {
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  Button,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";

export const Sidebar = ({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: React.Dispatch<React.SetStateAction<boolean>> }) => {
  return (
    <div>
      <OverlayDrawer
        modalType="non-modal"
        position="end"
        open={isOpen}
        onOpenChange={(_, { open }) => setIsOpen(open)}
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="secondary"
                aria-label="Close"
                icon={<Dismiss24Regular />}
                size="large"
                onClick={() => setIsOpen(false)}
              />
            }
          >
            Molvis
          </DrawerHeaderTitle>
        </DrawerHeader>

        <DrawerBody>
          <p>Some options</p>
        </DrawerBody>
      </OverlayDrawer>
    </div>
  );
};
