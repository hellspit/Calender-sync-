import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import LoginScreen from "../screens/LoginScreen";
import CalendarScreen from "../screens/CalendarScreen";
import ChatScreen from "../screens/ChatScreen";
import FreeTimeScreen from "../screens/FreeTimeScreen";
import { useAuth } from "../auth/AuthContext";

const Tab = createBottomTabNavigator();
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export default function AppNavigator() {
  const { isGoogleConnected, isMicrosoftConnected, isLoading } = useAuth();
  const hasAnyAccount = isGoogleConnected || isMicrosoftConnected;

  if (isLoading) return null;

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: "#7C6EFF",
          tabBarInactiveTintColor: "#3C3C5E",
          tabBarLabelStyle: styles.label,
          tabBarIcon: ({ focused, color }) => {
            let name: IoniconName;
            if (route.name === "Account") {
              name = focused ? "person" : "person-outline";
            } else if (route.name === "Calendar") {
              name = focused ? "calendar" : "calendar-outline";
            } else if (route.name === "Chat") {
              name = focused ? "chatbubbles" : "chatbubbles-outline";
            } else {
              name = focused ? "time" : "time-outline";
            }
            return <Ionicons name={name} size={21} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Account"
          component={LoginScreen}
          options={{ tabBarLabel: "Account" }}
        />
        {hasAnyAccount && (
          <>
            <Tab.Screen
              name="Calendar"
              component={CalendarScreen}
              options={{ tabBarLabel: "Calendar" }}
            />
            <Tab.Screen
              name="Chat"
              component={ChatScreen}
              options={{ tabBarLabel: "Chat" }}
            />
            <Tab.Screen
              name="Free Time"
              component={FreeTimeScreen}
              options={{ tabBarLabel: "Free Time" }}
            />
          </>
        )}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#0F0F1E",
    borderRadius: 28,
    height: 68,
    borderTopWidth: 1,
    borderColor: "#1E1E38",
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginTop: 1,
  },
});
