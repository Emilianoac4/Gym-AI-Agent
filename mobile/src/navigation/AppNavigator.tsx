import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../context/AuthContext";
import { designSystem } from "../theme/designSystem";
import { palette } from "../theme/palette";
import { LoginScreen } from "../screens/Auth/LoginScreen";
import { RegisterScreen } from "../screens/Auth/RegisterScreen";
import { ContactSalesScreen } from "../screens/Auth/ContactSalesScreen";
import { GymSelectorScreen } from "../screens/Auth/GymSelectorScreen";
import { ChangeTemporaryPasswordScreen } from "../screens/Auth/ChangeTemporaryPasswordScreen";
import { HomeScreen } from "../screens/Main/HomeScreen";
import { ProfileScreen } from "../screens/Main/ProfileScreen";
import { RoutineScreen } from "../screens/Main/RoutineScreen";
import { ChatScreen } from "../screens/Main/ChatScreen";
import { MeasurementsScreen } from "../screens/Main/MeasurementsScreen";
import { AdminUsersScreen } from "../screens/Main/AdminUsersScreen";
import { AdminProfileScreen } from "../screens/Main/AdminProfileScreen";
import { AdminMessagesScreen } from "../screens/Main/AdminMessagesScreen";
import { ActiveTrainersScreen } from "../screens/Main/ActiveTrainersScreen";
import { TrainerProfileScreen } from "../screens/Main/TrainerProfileScreen";
import { GymAvailabilityScreen } from "../screens/Main/GymAvailabilityScreen";
import { AvailabilityManagementScreen } from "../screens/Main/AvailabilityManagementScreen";
import { MessagesConversationScreen } from "../screens/Main/MessagesConversationScreen";
import { MyMessagesScreen } from "../screens/Main/MyMessagesScreen";
import { AssistanceScreen } from "../screens/Main/AssistanceScreen";
import { AssistanceRequestsScreen } from "../screens/Main/AssistanceRequestsScreen";
import { TrainerRoutineBuilderScreen } from "../screens/Main/TrainerRoutineBuilderScreen";
import { TrainerPresetsScreen } from "../screens/Main/TrainerPresetsScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.placeholderShell}>
      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderTitle}>{title}</Text>
        <Text style={styles.placeholderDescription}>{description}</Text>
      </View>
    </View>
  );
}

function MemberTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: designSystem.colors.primary,
        tabBarInactiveTintColor: designSystem.colors.textSecondary,
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: designSystem.colors.surface,
          borderTopColor: designSystem.colors.borderSubtle,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Medidas" component={MeasurementsScreen} />
      <Tab.Screen name="Rutina" component={RoutineScreen} />
      <Tab.Screen name="Asistencia" component={AssistanceScreen} />
      <Tab.Screen name="Coach" component={ChatScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function TrainerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.cocoa,
        tabBarInactiveTintColor: palette.tabInactive,
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: palette.card,
          borderTopColor: palette.line,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Usuarios" component={AdminUsersScreen} />
      <Tab.Screen name="Solicitudes" component={AssistanceRequestsScreen} />
      <Tab.Screen name="Horarios" component={AvailabilityManagementScreen} />
      <Tab.Screen name="Mensajes" component={MyMessagesScreen} />
      <Tab.Screen name="Perfil" component={TrainerProfileScreen} />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.cocoa,
        tabBarInactiveTintColor: palette.tabInactive,
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: palette.card,
          borderTopColor: palette.line,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tab.Screen name="Panel" component={HomeScreen} />
      <Tab.Screen name="Activos" component={ActiveTrainersScreen} />
      <Tab.Screen name="Usuarios" component={AdminUsersScreen} />
      <Tab.Screen name="Operacion" component={AvailabilityManagementScreen} />
      <Tab.Screen name="Mensajes" component={AdminMessagesScreen} />
      <Tab.Screen name="Perfil" component={AdminProfileScreen} />
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.background,
    primary: palette.cocoa,
    text: palette.ink,
    card: palette.card,
    border: palette.line,
  },
};

export function AppNavigator() {
  const { token, user, pendingGymSelection } = useAuth();

  const role = user?.role;

  const getMainNavigator = () => {
    if (role === "admin") {
      return AdminTabs;
    }

    if (role === "trainer") {
      return TrainerTabs;
    }

    return MemberTabs;
  };

  const MainNavigator = getMainNavigator();

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          user?.mustChangePassword ? (
            <Stack.Screen name="ChangeTemporaryPassword" component={ChangeTemporaryPasswordScreen} />
          ) : (
            <>
              <Stack.Screen name="Main" component={MainNavigator} />
              <Stack.Screen
                name="GymAvailability"
                component={GymAvailabilityScreen}
                options={{
                  headerShown: true,
                  title: "Disponibilidad",
                  headerStyle: { backgroundColor: palette.card },
                  headerTintColor: palette.cocoa,
                }}
              />
              <Stack.Screen
                name="AvailabilityManagement"
                component={AvailabilityManagementScreen}
                options={{
                  headerShown: true,
                  title: "Gestión de horarios",
                  headerStyle: { backgroundColor: palette.card },
                  headerTintColor: palette.cocoa,
                }}
              />
              <Stack.Screen
                name="MessageConversation"
                component={MessagesConversationScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="MyMessages"
                component={MyMessagesScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="TrainerRoutineBuilder"
                children={(props) => <TrainerRoutineBuilderScreen {...(props as any)} />}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="TrainerPresets"
                component={TrainerPresetsScreen}
                options={{ headerShown: false }}
              />
            </>
          )
        ) : (
          <>
            {pendingGymSelection ? (
              <Stack.Screen name="GymSelector" component={GymSelectorScreen} />
            ) : (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="ContactSales" component={ContactSalesScreen} />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  placeholderShell: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: palette.background,
  },
  placeholderCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
  placeholderTitle: {
    color: palette.cocoa,
    fontSize: 20,
    fontWeight: "800",
  },
  placeholderDescription: {
    marginTop: 8,
    color: palette.textMuted,
    lineHeight: 20,
  },
});
