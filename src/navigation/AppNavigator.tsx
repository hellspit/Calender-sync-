import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { Text } from "react-native";

import LoginScreen from "../screens/LoginScreen";
import CalendarScreen from "../screens/CalendarScreen";
import FreeTimeScreen from "../screens/FreeTimeScreen";
import { useAuth } from "../auth/AuthContext";

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  const { isGoogleConnected, isMicrosoftConnected, isLoading } = useAuth();
  const hasAnyAccount = isGoogleConnected || isMicrosoftConnected;

  if (isLoading) return null; // splash could go here

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#1A1A2E",
            borderTopColor: "#2A2A3E",
            borderTopWidth: 1,
            height: 64,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarActiveTintColor: "#6C63FF",
          tabBarInactiveTintColor: "#777",
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
          },
        }}
      >
        {/* Account screen always visible */}
        <Tab.Screen
          name="Account"
          component={LoginScreen}
          options={{
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 20, color }}>👤</Text>
            ),
          }}
        />

        {hasAnyAccount && (
          <>
            <Tab.Screen
              name="Calendar"
              component={CalendarScreen}
              options={{
                tabBarIcon: ({ color }) => (
                  <Text style={{ fontSize: 20, color }}>📅</Text>
                ),
              }}
            />
            <Tab.Screen
              name="Free Time"
              component={FreeTimeScreen}
              options={{
                tabBarIcon: ({ color }) => (
                  <Text style={{ fontSize: 20, color }}>⏰</Text>
                ),
              }}
            />
          </>
        )}
      </Tab.Navigator>
    </NavigationContainer>
  );
}
